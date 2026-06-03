import { prisma } from '../db';
import { recordStockOutflow, recordStockInflow, getStockStatus } from './inventory';

/**
 * Executes a light manufacturing assembly build.
 * Deducts raw materials, calculates final cost, adds finished inventory, 
 * and registers double-entry ledger adjustments.
 */
export async function runProductionJob(
  tenantId: string,
  bomId: string,
  quantityToBuild: number,
  createdByUserId: string,
  tx: any
): Promise<any> {
  if (quantityToBuild <= 0) {
    throw new Error('Quantity to build must be greater than zero');
  }

  // 1. Fetch BOM with items
  const bom = await tx.billOfMaterials.findUnique({
    where: { id: bomId, tenantId },
    include: {
      items: {
        include: { rawProduct: true },
      },
      finishedProduct: true,
    },
  });

  if (!bom) {
    throw new Error('Bill of Materials (BOM) not found');
  }

  // 2. Pre-verify stock availability for ALL raw items
  for (const item of bom.items) {
    const qtyNeeded = quantityToBuild * item.quantity;
    const stockStatus = await getStockStatus(tenantId, item.rawProductId, tx);
    
    if (stockStatus.quantity < qtyNeeded) {
      throw new Error(
        `Insufficient stock for raw material [${item.rawProduct.sku}] ${item.rawProduct.name}. ` +
        `Available: ${stockStatus.quantity}, Required: ${qtyNeeded}`
      );
    }
  }

  // 3. Create the Production Job record (marked PENDING while processing)
  const job = await tx.productionJob.create({
    data: {
      tenantId,
      bomId,
      quantityToBuild,
      status: 'PENDING',
      totalCost: 0.0,
    },
  });

  // 4. Consume raw materials and calculate costs
  let totalRawCost = 0.0;

  for (const item of bom.items) {
    const qtyNeeded = quantityToBuild * item.quantity;
    
    // Deduct stock and compute cost using FIFO/Weighted Average valuation
    const valuation = await recordStockOutflow(
      tenantId,
      item.rawProductId,
      qtyNeeded,
      'ASSEMBLY_CONSUMPTION',
      job.id,
      tx
    );

    totalRawCost += valuation.totalCOGS;
  }

  // 5. Add labor and overhead costs
  const totalLaborCost = quantityToBuild * bom.laborCost;
  const totalOverheadCost = quantityToBuild * bom.overheadCost;
  const totalCost = totalRawCost + totalLaborCost + totalOverheadCost;
  const unitCostOfFinishedProduct = totalCost / quantityToBuild;

  // 6. Record stock inflow of the finished product
  await recordStockInflow(
    tenantId,
    bom.finishedProductId,
    quantityToBuild,
    unitCostOfFinishedProduct,
    'ASSEMBLY_OUTPUT',
    job.id,
    tx
  );

  // 7. Update production job details
  const completedJob = await tx.productionJob.update({
    where: { id: job.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      totalCost: parseFloat(totalCost.toFixed(4)),
    },
  });

  // 8. Ledger posting for manufacturing assembly
  const accountCodes = {
    inventory: '13100', // Inventory Asset
    labor: '50200',     // Direct Labor Expense
    overhead: '50300'   // Manufacturing Overheads
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
  const laborAccount = getAccount(accountCodes.labor);
  const overheadAccount = getAccount(accountCodes.overhead);

  const journalLinesData = [
    // DEBIT: Finished Goods Inventory Increase
    {
      tenantId,
      accountId: inventoryAccount.id,
      debit: totalCost,
      credit: 0.0,
      narration: `Finished stock increase from Assembly Job for [${bom.finishedProduct.sku}] x ${quantityToBuild}`,
    },
    // CREDIT: Raw Material Inventory Decrease
    {
      tenantId,
      accountId: inventoryAccount.id,
      debit: 0.0,
      credit: totalRawCost,
      narration: `Raw material consumption from Assembly Job for [${bom.finishedProduct.sku}] x ${quantityToBuild}`,
    },
  ];

  // CREDIT: Direct Labor offset/expense
  if (totalLaborCost > 0) {
    journalLinesData.push({
      tenantId,
      accountId: laborAccount.id,
      debit: 0.0,
      credit: totalLaborCost,
      narration: `Direct labor allocated to production of [${bom.finishedProduct.sku}] x ${quantityToBuild}`,
    });
  }

  // CREDIT: Manufacturing Overhead offset/expense
  if (totalOverheadCost > 0) {
    journalLinesData.push({
      tenantId,
      accountId: overheadAccount.id,
      debit: 0.0,
      credit: totalOverheadCost,
      narration: `Overheads allocated to production of [${bom.finishedProduct.sku}] x ${quantityToBuild}`,
    });
  }

  // Post double entry journal
  await tx.journalEntry.create({
    data: {
      tenantId,
      reference: `JOB-${completedJob.id.substring(0, 8).toUpperCase()}`,
      narration: `Auto-generated assembly ledger entries for Job ID ${completedJob.id}`,
      createdByUserId,
      lines: {
        create: journalLinesData,
      },
    },
  });

  return completedJob;
}
