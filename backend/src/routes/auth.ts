import { Router, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { createDefaultCoA } from '../services/coaHelper';
import { authenticateJWT } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-fastaccounts-erp';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, companyName, email, password } = req.body;

  if (!name || !companyName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          currency: 'USD',
          taxRate: 15.0, // Default 15% VAT
        },
      });

      // 2. Create user
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      });

      // 3. Create default Chart of Accounts
      await createDefaultCoA(tenant.id, tx);

      return { user, tenant };
    });

    // Sign JWT
    const token = jwt.sign(
      {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        tenantId: result.tenant.id,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      tenant: result.tenant,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error during registration process' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Sign JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenant: user.tenant,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error during login process' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    let user: any = null;
    let tenant: any = null;

    if (req.user.role === 'SUPERADMIN') {
      const superuser = await prisma.superUser.findUnique({
        where: { id: req.user.id },
      });
      if (superuser) {
        user = {
          id: superuser.id,
          email: superuser.email,
          name: superuser.name,
          role: 'SUPERADMIN',
        };
        tenant = { id: 'MASTER', name: 'Buraq Cloud Core Services', currency: 'USD', taxRate: 0 };
      }
    } else {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { tenant: true },
      });
      if (dbUser) {
        user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
        };
        tenant = dbUser.tenant;
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({ user, tenant });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// PUT /api/auth/tenant
router.put('/tenant', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.tenantId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { name, currency, taxRate } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  try {
    const updatedTenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        name,
        currency: currency || 'USD',
        taxRate: parseFloat(taxRate) !== undefined ? parseFloat(taxRate) : 0.0,
      },
    });

    res.json(updatedTenant);
  } catch (error) {
    console.error('Tenant update error:', error);
    res.status(500).json({ error: 'Error updating company settings' });
  }
});

export default router;

