import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';
import { runProductionJob } from '../services/assembly';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/manufacturing/boms - Fetch all BOMs
router.get('/boms', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const boms = await prisma.billOfMaterials.findMany({
      where: { tenantId },
      include: {
        finishedProduct: true,
        items: {
          include: {
            rawProduct: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(boms);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching Bill of Materials' });
  }
});

// POST /api/manufacturing/boms - Create a Bill of Materials
router.post('/boms', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { finishedProductId, name, laborCost, overheadCost, items } = req.body;

  if (!finishedProductId || !name || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Finished product, name, and component items are required' });
  }

  const labor = parseFloat(laborCost) || 0.0;
  const overhead = parseFloat(overheadCost) || 0.0;

  if (labor < 0 || overhead < 0) {
    return res.status(400).json({ error: 'Labor and overhead costs cannot be negative' });
  }

  try {
    // 1. Verify finished product is of type STOCK
    const finishedProduct = await prisma.product.findFirst({
      where: { id: finishedProductId, tenantId, type: 'STOCK' },
    });

    if (!finishedProduct) {
      return res.status(400).json({ error: 'Finished product must be a valid stock item' });
    }

    // 2. Validate all components are stock items
    const rawProductIds = items.map((i: any) => i.rawProductId);
    const rawProducts = await prisma.product.findMany({
      where: {
        tenantId,
        id: { in: rawProductIds },
        type: 'STOCK',
      },
    });

    if (rawProducts.length !== new Set(rawProductIds).size) {
      return res.status(400).json({ error: 'One or more raw materials are invalid or not stock items' });
    }

    // Validate quantities
    for (const item of items) {
      if (parseFloat(item.quantity) <= 0) {
        return res.status(400).json({ error: 'Component quantities must be greater than zero' });
      }
    }

    // 3. Create BOM in transaction
    const newBOM = await prisma.$transaction(async (tx) => {
      return await tx.billOfMaterials.create({
        data: {
          tenantId,
          finishedProductId,
          name,
          laborCost: labor,
          overheadCost: overhead,
          items: {
            create: items.map((i: any) => ({
              tenantId,
              rawProductId: i.rawProductId,
              quantity: parseFloat(i.quantity),
            })),
          },
        },
        include: {
          finishedProduct: true,
          items: {
            include: {
              rawProduct: true,
            },
          },
        },
      });
    });

    res.status(201).json(newBOM);
  } catch (error) {
    console.error('BOM creation error:', error);
    res.status(500).json({ error: 'Error creating Bill of Materials' });
  }
});

// GET /api/manufacturing/jobs - Fetch all production jobs
router.get('/jobs', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const jobs = await prisma.productionJob.findMany({
      where: { tenantId },
      include: {
        bom: {
          include: {
            finishedProduct: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching Production Jobs' });
  }
});

// POST /api/manufacturing/jobs - Execute a Production Job (Build assembly)
router.post('/jobs', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { bomId, quantityToBuild } = req.body;

  const qty = parseFloat(quantityToBuild);
  if (!bomId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'BOM and a building quantity greater than zero are required' });
  }

  try {
    const job = await prisma.$transaction(async (tx) => {
      return await runProductionJob(tenantId, bomId, qty, createdByUserId, tx);
    });

    res.status(201).json({
      success: true,
      message: `Successfully assembled ${qty} units of finished product`,
      job,
    });
  } catch (error: any) {
    console.error('Production job build error:', error);
    res.status(400).json({ error: error.message || 'Error executing production job' });
  }
});

export default router;
