import { Router, Response, NextFunction } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { createDefaultCoA } from '../services/coaHelper';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-fastaccounts-erp';

// Helper to write audit logs
async function logSuperAdminAction(superUserId: string, action: string, details: string) {
  try {
    await prisma.globalAuditLog.create({
      data: {
        superUserId,
        action,
        details,
      },
    });
  } catch (err) {
    console.error('Failed to log SuperAdmin action:', err);
  }
}

// Custom middleware to verify SuperAdmin requests
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Access forbidden: SuperAdmin role required' });
  }
  next();
}

// POST /api/superadmin/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const superuser = await prisma.superUser.findUnique({
      where: { email },
    });

    if (!superuser) {
      return res.status(401).json({ error: 'Invalid super admin credentials' });
    }

    const validPassword = bcrypt.compareSync(password, superuser.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid super admin credentials' });
    }

    // Sign JWT with SUPERADMIN role
    const token = jwt.sign(
      {
        id: superuser.id,
        email: superuser.email,
        name: superuser.name,
        role: 'SUPERADMIN',
        tenantId: 'MASTER',
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    await logSuperAdminAction(superuser.id, 'LOGIN', `SuperAdmin logged in from Express API`);

    res.json({
      token,
      user: {
        id: superuser.id,
        email: superuser.email,
        name: superuser.name,
        role: 'SUPERADMIN',
      },
      tenant: { id: 'MASTER', name: 'Buraq Cloud Core Services' }
    });
  } catch (error) {
    console.error('SuperAdmin login error:', error);
    res.status(500).json({ error: 'Error during SuperAdmin login process' });
  }
});

// GET /api/superadmin/tenants - Get all tenants & metadata (Requires Auth + SuperAdmin guard)
router.get('/tenants', authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        subscription: true,
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          }
        },
      },
    });

    // Fetch storage metrics (approximate counts of records per tenant to estimate storage usage)
    const formattedTenants = await Promise.all(
      tenants.map(async (t) => {
        const userCount = t.users.length;
        const journalCount = await prisma.journalEntry.count({ where: { tenantId: t.id } });
        const invoiceCount = await prisma.invoice.count({ where: { tenantId: t.id } });
        const productCount = await prisma.product.count({ where: { tenantId: t.id } });
        
        // Storage size approximation: 1 record = ~0.5KB
        const totalRecords = userCount + journalCount + invoiceCount + productCount;
        const storageUsageKB = Math.max(16, Math.round(totalRecords * 0.5));

        return {
          id: t.id,
          name: t.name,
          currency: t.currency,
          taxRate: t.taxRate,
          createdAt: t.createdAt,
          subscription: t.subscription || {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            moduleAccounts: true,
            moduleManufacturing: true,
            moduleInventory: true,
            moduleHR: false,
            moduleCRM: false,
            moduleSales: true,
          },
          users: t.users,
          userCount,
          activeSessions: Math.floor(Math.random() * userCount) + 1, // simulated session tracker
          storageUsageKB,
        };
      })
    );

    res.json(formattedTenants);
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ error: 'Failed to retrieve tenant list' });
  }
});

// POST /api/superadmin/tenants - Provision new Tenant (Requires Auth + SuperAdmin guard)
router.post('/tenants', authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { name, currency, taxRate, adminName, adminEmail, adminPassword, subscriptionTier, endDate } = req.body;

  if (!name || !adminName || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'Company Name, Admin Name, Email and Password are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Admin Email already registered in system' });
    }

    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    const superUserId = req.user!.id;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name,
          currency: currency || 'USD',
          taxRate: parseFloat(taxRate) || 15.0,
        },
      });

      // 2. Create default Subscription
      const subEndDate = endDate ? new Date(endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          status: 'ACTIVE',
          endDate: subEndDate,
          moduleAccounts: true,
          moduleManufacturing: subscriptionTier === 'ENTERPRISE',
          moduleInventory: true,
          moduleHR: false,
          moduleCRM: false,
          moduleSales: true,
        },
      });

      // 3. Create Tenant Admin User
      const user = await tx.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: adminName,
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      });

      // 4. Create Standard CoA
      await createDefaultCoA(tenant.id, tx);

      return { tenant, subscription, user };
    });

    await logSuperAdminAction(
      superUserId, 
      'PROVISION_TENANT', 
      `SuperAdmin provisioned Tenant: ${name} (${result.tenant.id}) with Admin: ${adminEmail}`
    );

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Provisioning error:', error);
    res.status(500).json({ error: error.message || 'Error provisioning tenant client' });
  }
});

// PUT /api/superadmin/tenants/:id/status - Update subscription state (Requires Auth + SuperAdmin guard)
router.put('/tenants/:id/status', authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status, endDate } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const superUserId = req.user!.id;
    const subscription = await prisma.tenantSubscription.upsert({
      where: { tenantId: id },
      update: {
        status,
        ...(endDate && { endDate: new Date(endDate) }),
      },
      create: {
        tenantId: id,
        status,
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    await logSuperAdminAction(
      superUserId,
      'UPDATE_SUBSCRIPTION_STATUS',
      `SuperAdmin set status for Tenant ID: ${id} to ${status}`
    );

    res.json(subscription);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

// PUT /api/superadmin/tenants/:id/modules - Toggle modules (Requires Auth + SuperAdmin guard)
router.put('/tenants/:id/modules', authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { 
    moduleAccounts, 
    moduleManufacturing, 
    moduleInventory, 
    moduleHR, 
    moduleCRM, 
    moduleSales 
  } = req.body;

  try {
    const superUserId = req.user!.id;
    const subscription = await prisma.tenantSubscription.upsert({
      where: { tenantId: id },
      update: {
        moduleAccounts: moduleAccounts !== undefined ? moduleAccounts : true,
        moduleManufacturing: moduleManufacturing !== undefined ? moduleManufacturing : true,
        moduleInventory: moduleInventory !== undefined ? moduleInventory : true,
        moduleHR: moduleHR !== undefined ? moduleHR : false,
        moduleCRM: moduleCRM !== undefined ? moduleCRM : false,
        moduleSales: moduleSales !== undefined ? moduleSales : true,
      },
      create: {
        tenantId: id,
        status: 'ACTIVE',
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        moduleAccounts,
        moduleManufacturing,
        moduleInventory,
        moduleHR,
        moduleCRM,
        moduleSales,
      },
    });

    await logSuperAdminAction(
      superUserId,
      'UPDATE_SUBSCRIPTION_MODULES',
      `SuperAdmin modified feature modules for Tenant ID: ${id}`
    );

    res.json(subscription);
  } catch (error) {
    console.error('Update modules error:', error);
    res.status(500).json({ error: 'Failed to update tenant functional modules' });
  }
});

// POST /api/superadmin/tenants/:id/impersonate - Impersonate client admin (Requires Auth + SuperAdmin guard)
router.post('/tenants/:id/impersonate', authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const superUserId = req.user!.id;
    // Find first admin user of this tenant
    const adminUser = await prisma.user.findFirst({
      where: { 
        tenantId: id,
        role: 'ADMIN',
      },
      include: { tenant: true },
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'No admin user profile found for this tenant workspace' });
    }

    // Sign a tenant-scoped login token valid for 1 hour
    const token = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        tenantId: adminUser.tenantId,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await logSuperAdminAction(
      superUserId,
      'IMPERSONATION_START',
      `SuperAdmin initiated impersonation session for Tenant: ${adminUser.tenant.name} (${id}) under user: ${adminUser.email}`
    );

    res.json({
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      },
      tenant: adminUser.tenant,
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    res.status(500).json({ error: 'Error generating support impersonation credentials' });
  }
});

// GET /api/superadmin/logs - Retrieve audit logs (Requires Auth + SuperAdmin guard)
router.get('/logs', authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const logs = await prisma.globalAuditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
    
    // Map with superuser details
    const logsWithUser = await Promise.all(
      logs.map(async (l) => {
        const u = await prisma.superUser.findUnique({
          where: { id: l.superUserId },
          select: { name: true, email: true },
        });
        return {
          ...l,
          superUser: u || { name: 'System / Deleted SuperUser', email: 'N/A' },
        };
      })
    );

    res.json(logsWithUser);
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve global audit trail logs' });
  }
});

// GET /api/superadmin/metrics - System health metrics (Requires Auth + SuperAdmin guard)
router.get('/metrics', authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantCount = await prisma.tenant.count();
    const userCount = await prisma.user.count();
    const activeSubs = await prisma.tenantSubscription.count({ where: { status: 'ACTIVE' } });
    const suspendedSubs = await prisma.tenantSubscription.count({ where: { status: 'SUSPENDED' } });
    
    // Database file size approximation (SQLite dev.db)
    const totalJournals = await prisma.journalEntry.count();
    const totalLines = await prisma.journalLine.count();
    const totalInvoices = await prisma.invoice.count();
    const dbSizeApproxMB = Math.max(0.3, parseFloat(((tenantCount * 0.1) + (totalLines * 0.002) + (totalInvoices * 0.002)).toFixed(2)));

    // Simulated API performance data
    res.json({
      tenantCount,
      userCount,
      activeSubs,
      suspendedSubs,
      dbSizeApproxMB,
      apiGatewayStatus: 'ONLINE',
      backgroundWorkerQueue: {
        active: 0,
        completed: 1843,
        failed: 2,
        status: 'IDLE',
      },
      systemCpuLoadPercent: Math.floor(Math.random() * 8) + 4, // simulated load
      systemMemoryUsageBytes: '143.5 MB',
      concurrentConnections: Math.floor(Math.random() * 5) + 3,
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: 'Failed to load cloud system metrics' });
  }
});

export default router;
