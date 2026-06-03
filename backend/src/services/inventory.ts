import { prisma } from '../db';

export interface ValuationResult {
  totalCOGS: number;
  unitCost: number;
}

/**
 * Record stock inflow (purchase bill, assembly output, etc.)
 */
export async function recordStockInflow(
  tenantId: string,
  productId: string,
  quantity: number,
  unitCost: number,
  referenceType: string,
  referenceId: string,
  txClient?: any,
  warehouse?: string
): Promise<void> {
  const db = txClient || prisma;

  if (quantity <= 0) {
    throw new Error('Inflow quantity must be greater than zero');
  }
  if (unitCost < 0) {
    throw new Error('Unit cost cannot be negative');
  }

  // Get product details
  const product = await db.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  if (product.type !== 'STOCK') {
    // Non-stock items and services don't track inventory
    return;
  }

  // Create Stock Transaction
  await db.stockTransaction.create({
    data: {
      tenantId,
      productId,
      quantity,
      unitCost,
      remainingQty: quantity, // For FIFO tracking
      referenceType,
      referenceId,
      warehouse: warehouse || 'Main Warehouse',
    },
  });

  // For Weighted Average, update the product's costPrice
  if (product.inventoryValuationMethod === 'WEIGHTED_AVERAGE') {
    // Calculate current total stock and value
    const txns = await db.stockTransaction.findMany({
      where: { tenantId, productId },
    });

    let currentQty = 0;
    let currentValue = 0;

    for (const t of txns) {
      currentQty += t.quantity;
      currentValue += t.quantity * t.unitCost;
    }

    // New average cost (avoid division by zero)
    const newAvgCost = currentQty > 0 ? currentValue / currentQty : unitCost;

    await db.product.update({
      where: { id: productId },
      data: { costPrice: parseFloat(newAvgCost.toFixed(4)) },
    });
  } else {
    // For FIFO, set costPrice to the latest inflow cost
    await db.product.update({
      where: { id: productId },
      data: { costPrice: unitCost },
    });
  }
}

/**
 * Record stock outflow (sales invoice, assembly consumption, etc.)
 * Returns the computed total COGS (cost of goods sold) and unit cost.
 */
export async function recordStockOutflow(
  tenantId: string,
  productId: string,
  quantity: number,
  referenceType: string,
  referenceId: string,
  txClient?: any,
  warehouse?: string
): Promise<ValuationResult> {
  const db = txClient || prisma;

  if (quantity <= 0) {
    throw new Error('Outflow quantity must be greater than zero');
  }

  const product = await db.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  if (product.type !== 'STOCK') {
    return { totalCOGS: 0, unitCost: 0 };
  }

  const targetWarehouse = warehouse || 'Main Warehouse';

  // Check stock quantity in the target warehouse first
  const txns = await db.stockTransaction.findMany({
    where: { tenantId, productId, warehouse: targetWarehouse },
  });

  const totalQty = txns.reduce((sum: number, t: any) => sum + t.quantity, 0);
  if (totalQty < quantity) {
    throw new Error(`Insufficient stock for product [${product.sku}] at [${targetWarehouse}]. Available: ${totalQty}, Requested: ${quantity}`);
  }

  let totalCOGS = 0;

  if (product.inventoryValuationMethod === 'FIFO') {
    // Find all positive stock transactions in this warehouse with remainingQty > 0, sorted by date ASC
    const activeInflows = await db.stockTransaction.findMany({
      where: {
        tenantId,
        productId,
        warehouse: targetWarehouse,
        quantity: { gt: 0 },
        remainingQty: { gt: 0 },
      },
      orderBy: [
        { date: 'asc' },
        { id: 'asc' },
      ],
    });

    let remainingRequest = quantity;

    for (const inflow of activeInflows) {
      if (remainingRequest <= 0) break;

      const takeQty = Math.min(inflow.remainingQty, remainingRequest);
      totalCOGS += takeQty * inflow.unitCost;
      remainingRequest -= takeQty;

      // Update remainingQty of the inflow transaction
      await db.stockTransaction.update({
        where: { id: inflow.id },
        data: { remainingQty: inflow.remainingQty - takeQty },
      });
    }

    if (remainingRequest > 0) {
      throw new Error(`FIFO queue discrepancy for [${product.sku}] at [${targetWarehouse}]. Could not fulfill ${remainingRequest} units.`);
    }
  } else {
    // WEIGHTED AVERAGE
    // COGS = quantity * product's current costPrice
    totalCOGS = quantity * product.costPrice;
  }

  const calculatedUnitCost = totalCOGS / quantity;

  // Create outflow transaction (negative quantity)
  await db.stockTransaction.create({
    data: {
      tenantId,
      productId,
      quantity: -quantity,
      unitCost: calculatedUnitCost,
      remainingQty: 0, // Outflows do not seed FIFO queue
      referenceType,
      referenceId,
      warehouse: targetWarehouse,
    },
  });

  return {
    totalCOGS: parseFloat(totalCOGS.toFixed(4)),
    unitCost: parseFloat(calculatedUnitCost.toFixed(4)),
  };
}

/**
 * Get current stock levels and cost details for a product
 */
export async function getStockStatus(tenantId: string, productId: string, txClient?: any, warehouse?: string) {
  const db = txClient || prisma;

  const product = await db.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  if (product.type !== 'STOCK') {
    return {
      quantity: 0,
      averageCost: 0,
      totalValue: 0,
    };
  }

  const whereClause: any = { tenantId, productId };
  if (warehouse) {
    whereClause.warehouse = warehouse;
  }

  const txns = await db.stockTransaction.findMany({
    where: whereClause,
  });

  const quantity = txns.reduce((sum: number, t: any) => sum + t.quantity, 0);
  const totalValue = txns.reduce((sum: number, t: any) => sum + (t.quantity * t.unitCost), 0);
  const averageCost = quantity > 0 ? totalValue / quantity : product.costPrice;

  return {
    quantity: parseFloat(quantity.toFixed(4)),
    averageCost: parseFloat(averageCost.toFixed(4)),
    totalValue: parseFloat(totalValue.toFixed(4)),
  };
}
