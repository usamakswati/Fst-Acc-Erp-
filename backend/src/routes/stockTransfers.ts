import { Router } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';
import { recordStockInflow, recordStockOutflow, getStockStatus } from '../services/inventory';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/inventory/transfers - Get all stock transfers
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const transfers = await prisma.stockTransfer.findMany({
      where: { tenantId },
      include: {
        product: {
          select: {
            sku: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json(transfers);
  } catch (error) {
    console.error('Error fetching stock transfers:', error);
    res.status(500).json({ error: 'Error fetching stock transfers' });
  }
});

// POST /api/inventory/transfers - Create a new stock transfer
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { productId, quantity, fromWarehouse, toWarehouse, transferNumber, date } = req.body;

  const qty = parseFloat(quantity);
  if (!productId) {
    return res.status(400).json({ error: 'Product is required' });
  }
  if (!qty || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than zero' });
  }
  if (!fromWarehouse || !toWarehouse) {
    return res.status(400).json({ error: 'Source and destination warehouses are required' });
  }
  if (fromWarehouse === toWarehouse) {
    return res.status(400).json({ error: 'Source and destination warehouses cannot be the same' });
  }

  try {
    const transfer = await prisma.$transaction(async (tx) => {
      // 1. Check stock in source warehouse
      const sourceStatus = await getStockStatus(tenantId, productId, tx, fromWarehouse);
      if (sourceStatus.quantity < qty) {
        throw new Error(`Insufficient stock in ${fromWarehouse}. Available: ${sourceStatus.quantity}, Requested: ${qty}`);
      }

      // 2. Determine transfer number
      let finalTransferNumber = transferNumber;
      if (!finalTransferNumber) {
        const count = await tx.stockTransfer.count({ where: { tenantId } });
        finalTransferNumber = `TR-${(count + 1).toString().padStart(5, '0')}`;
      }

      // Check if transfer number already exists to avoid unique constraint violations
      const existing = await tx.stockTransfer.findUnique({
        where: {
          tenantId_transferNumber: {
            tenantId,
            transferNumber: finalTransferNumber,
          },
        },
      });
      if (existing) {
        throw new Error(`Transfer number ${finalTransferNumber} already exists`);
      }

      // 3. Record stock outflow from source warehouse
      const outflowResult = await recordStockOutflow(
        tenantId,
        productId,
        qty,
        'STOCK_TRANSFER',
        finalTransferNumber,
        tx,
        fromWarehouse
      );

      // 4. Record stock inflow into destination warehouse
      await recordStockInflow(
        tenantId,
        productId,
        qty,
        outflowResult.unitCost,
        'STOCK_TRANSFER',
        finalTransferNumber,
        tx,
        toWarehouse
      );

      // 5. Save the stock transfer record
      const transferRecord = await tx.stockTransfer.create({
        data: {
          tenantId,
          transferNumber: finalTransferNumber,
          productId,
          quantity: qty,
          fromWarehouse,
          toWarehouse,
          date: date ? new Date(date) : new Date(),
        },
        include: {
          product: {
            select: {
              sku: true,
              name: true,
            },
          },
        },
      });

      return transferRecord;
    });

    res.status(201).json(transfer);
  } catch (error: any) {
    console.error('Stock transfer error:', error);
    res.status(400).json({ error: error.message || 'Error processing stock transfer' });
  }
});

export default router;
