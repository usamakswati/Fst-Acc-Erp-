import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';
import { getStockStatus, recordStockInflow, recordStockOutflow } from '../services/inventory';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/inventory/products - Get all products
router.get('/products', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const products = await prisma.product.findMany({
      where: { tenantId },
      orderBy: { sku: 'asc' },
    });

    // Decorate STOCK products with current stock status
    const decoratedProducts = await Promise.all(
      products.map(async (p) => {
        if (p.type !== 'STOCK') {
          return {
            ...p,
            stockQuantity: 0,
            averageCost: 0,
            stockValue: 0,
            warehouseQuantities: {
              "Main Warehouse": 0,
              "Retail Outlet": 0,
            }
          };
        }
        const status = await getStockStatus(tenantId, p.id);
        const mainStatus = await getStockStatus(tenantId, p.id, prisma, "Main Warehouse");
        const retailStatus = await getStockStatus(tenantId, p.id, prisma, "Retail Outlet");
        return {
          ...p,
          stockQuantity: status.quantity,
          averageCost: status.averageCost,
          stockValue: status.totalValue,
          warehouseQuantities: {
            "Main Warehouse": mainStatus.quantity,
            "Retail Outlet": retailStatus.quantity,
          }
        };
      })
    );

    res.json(decoratedProducts);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching products list' });
  }
});

// POST /api/inventory/products - Create a new product
router.post('/products', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { sku, name, type, salesPrice, costPrice, inventoryValuationMethod, packSize, hsCode, openingStockQty } = req.body;

  if (!sku || !name || !type) {
    return res.status(400).json({ error: 'SKU, name, and type are required' });
  }

  try {
    const existing = await prisma.product.findUnique({
      where: {
        tenantId_sku: { tenantId, sku },
      },
    });

    if (existing) {
      return res.status(400).json({ error: `Product with SKU ${sku} already exists` });
    }

    const priceSales = parseFloat(salesPrice) || 0.0;
    const priceCost = parseFloat(costPrice) || 0.0;
    const openQty = parseFloat(openingStockQty) || 0.0;

    if (priceSales < 0 || priceCost < 0 || openQty < 0) {
      return res.status(400).json({ error: 'Prices and opening quantities must be non-negative' });
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          tenantId,
          sku,
          name,
          type,
          salesPrice: priceSales,
          costPrice: priceCost,
          inventoryValuationMethod: inventoryValuationMethod || 'FIFO',
          packSize: packSize || 'Single',
          hsCode: hsCode || null,
        },
      });

      // Record opening stock inflow if provided
      if (p.type === 'STOCK' && openQty > 0) {
        await recordStockInflow(
          tenantId,
          p.id,
          openQty,
          priceCost,
          'INITIAL_STOCK',
          'OPENING_BAL',
          tx
        );
      }

      return p;
    });

    // Fetch decorated stock status
    const status = await getStockStatus(tenantId, product.id);

    res.status(201).json({
      ...product,
      stockQuantity: status.quantity,
      averageCost: status.averageCost,
      stockValue: status.totalValue,
    });
  } catch (error: any) {
    console.error('Product creation error:', error);
    res.status(500).json({ error: 'Error creating product' });
  }
});

// GET /api/inventory/products/:id/stock - Get detailed stock status
router.get('/products/:id/stock', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    const status = await getStockStatus(tenantId, id);
    res.json(status);
  } catch (error: any) {
    res.status(404).json({ error: error.message || 'Error fetching stock status' });
  }
});

// POST /api/inventory/products/:id/stock-adjustment - Manual inventory adjustment (increase/decrease)
router.post('/products/:id/stock-adjustment', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;
  const { quantity, unitCost, description, warehouse } = req.body;

  const adjQty = parseFloat(quantity);
  const adjCost = parseFloat(unitCost) || 0.0;
  const targetWarehouse = warehouse || 'Main Warehouse';

  if (isNaN(adjQty) || adjQty === 0) {
    return res.status(400).json({ error: 'Quantity must be non-zero' });
  }
  if (adjCost < 0) {
    return res.status(400).json({ error: 'Unit cost must be non-negative' });
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      let finalValue = 0;

      if (adjQty > 0) {
        // 1. Add Stock Transaction inflow
        await recordStockInflow(
          tenantId,
          id,
          adjQty,
          adjCost,
          'INITIAL_STOCK',
          description || 'MANUAL_ADJ',
          tx,
          targetWarehouse
        );
        finalValue = adjQty * adjCost;
      } else {
        // 1. Record stock outflow (decrease)
        const result = await recordStockOutflow(
          tenantId,
          id,
          Math.abs(adjQty),
          'INITIAL_STOCK',
          description || 'MANUAL_ADJ',
          tx,
          targetWarehouse
        );
        finalValue = result.totalCOGS;
      }

      // 2. Also record double-entry for manual adjustment!
      // For Increase: Debit Inventory Asset (13100), Credit Retained Earnings (30200)
      // For Decrease: Debit Retained Earnings (30200), Credit Inventory Asset (13100)
      const accountCodes = {
        inventory: '13100',
        retainedEarnings: '30200',
      };

      const accounts = await tx.account.findMany({
        where: {
          tenantId,
          code: { in: Object.values(accountCodes) },
        },
      });

      const getAccount = (code: string) => {
        const acc = accounts.find((a: any) => a.code === code);
        if (!acc) {
          throw new Error(`Required ledger account [Code: ${code}] is missing from tenant's Chart of Accounts.`);
        }
        return acc;
      };

      const inventoryAccount = getAccount(accountCodes.inventory);
      const reAccount = getAccount(accountCodes.retainedEarnings);

      const debitAccount = adjQty > 0 ? inventoryAccount : reAccount;
      const creditAccount = adjQty > 0 ? reAccount : inventoryAccount;

      await tx.journalEntry.create({
        data: {
          tenantId,
          narration: `Manual stock adjustment (${adjQty > 0 ? 'Increase' : 'Decrease'}) for Product ID ${id} in ${targetWarehouse}: ${description || ''}`,
          createdByUserId: req.user!.id,
          lines: {
            create: [
              {
                tenantId,
                accountId: debitAccount.id,
                debit: finalValue,
                credit: 0.0,
                narration: `Manual stock adjustment asset ${adjQty > 0 ? 'increase' : 'decrease'}`,
              },
              {
                tenantId,
                accountId: creditAccount.id,
                debit: 0.0,
                credit: finalValue,
                narration: `Manual stock adjustment offset`,
              },
            ],
          },
        },
      });

      return `Stock adjustment ${adjQty > 0 ? 'increase' : 'decrease'} saved successfully and ledger postings created`;
    });

    const status = await getStockStatus(tenantId, id);
    res.json({
      success: true,
      message,
      stockStatus: status,
    });
  } catch (error: any) {
    console.error('Stock adjustment error:', error);
    res.status(500).json({ error: error.message || 'Error processing stock adjustment' });
  }
});

export default router;
