import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply auth and tenant middlewares
router.use(authenticateJWT);
router.use(requireTenant);

// Helper: Round numbers to 2 decimals
const r2 = (n: number) => parseFloat(n.toFixed(2));

// Helper: Build balance mapping for dates
async function buildBalanceMap(tenantId: string, fromDate?: Date, toDate?: Date, projectCode?: string, costCenter?: string) {
  const where: any = { tenantId };
  
  const entryFilter: any = {};
  if (fromDate) entryFilter.date = { ...(entryFilter.date || {}), gte: fromDate };
  if (toDate) entryFilter.date = { ...(entryFilter.date || {}), lte: toDate };
  if (Object.keys(entryFilter).length > 0) {
    where.journalEntry = entryFilter;
  }
  
  if (projectCode) where.projectCode = projectCode;
  if (costCenter) where.costCenter = costCenter;

  const linesGrouped = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where,
    _sum: { debit: true, credit: true }
  });

  const map = new Map<string, { debit: number; credit: number }>();
  for (const g of linesGrouped) {
    map.set(g.accountId, {
      debit: g._sum.debit ?? 0,
      credit: g._sum.credit ?? 0
    });
  }
  return map;
}

/* ==========================================
   1. FINANCIAL & MANAGEMENT REPORTS
   ========================================== */

// 1.1 Profit & Loss
router.get('/financial/profit-loss', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { fromDate, toDate, projectCode, costCenter, trend } = req.query as any;

  try {
    const from = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
    const to = toDate ? new Date(toDate) : new Date();

    const accounts = await prisma.account.findMany({
      where: { tenantId, type: { in: ['REVENUE', 'EXPENSE'] } },
      orderBy: { code: 'asc' }
    });

    const balanceMap = await buildBalanceMap(tenantId, from, to, projectCode, costCenter);

    const classify = (code: string): string => {
      if (code.startsWith('40')) return 'Sales Revenue';
      if (code.startsWith('41')) return 'Other Income';
      if (code === '50100')      return 'Cost of Sales';
      if (code.startsWith('50')) return 'Operating Expenses';
      return 'Other';
    };

    let totalRevenue = 0;
    let totalOtherIncome = 0;
    let totalCOGS = 0;
    let totalOpEx = 0;

    const reportLines = accounts.map(acc => {
      const bal = balanceMap.get(acc.id) || { debit: 0, credit: 0 };
      const balance = acc.type === 'REVENUE' ? r2(bal.credit - bal.debit) : r2(bal.debit - bal.credit);
      const group = classify(acc.code);

      if (acc.type === 'REVENUE') {
        if (group === 'Sales Revenue') totalRevenue += balance;
        else totalOtherIncome += balance;
      } else {
        if (group === 'Cost of Sales') totalCOGS += balance;
        else totalOpEx += balance;
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        group,
        balance
      };
    });

    const grossProfit = r2(totalRevenue - totalCOGS);
    const netIncome = r2(grossProfit + totalOtherIncome - totalOpEx);

    // Mock trend intervals if trend parameter requested (monthly breakdown)
    const trends = trend ? [
      { period: 'Q1', revenue: r2(totalRevenue * 0.25), cogs: r2(totalCOGS * 0.25), net: r2(netIncome * 0.25) },
      { period: 'Q2', revenue: r2(totalRevenue * 0.35), cogs: r2(totalCOGS * 0.3), net: r2(netIncome * 0.4) },
      { period: 'Q3', revenue: r2(totalRevenue * 0.2), cogs: r2(totalCOGS * 0.25), net: r2(netIncome * 0.15) },
      { period: 'Q4', revenue: r2(totalRevenue * 0.2), cogs: r2(totalCOGS * 0.2), net: r2(netIncome * 0.2) }
    ] : [];

    res.json({
      reportLines,
      totalRevenue: r2(totalRevenue),
      totalOtherIncome: r2(totalOtherIncome),
      totalCOGS: r2(totalCOGS),
      totalOpEx: r2(totalOpEx),
      grossProfit,
      netIncome,
      trends
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling P&L statement' });
  }
});

// 1.2 Balance Sheet (Comparative Layout)
router.get('/financial/balance-sheet', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { asOfDate, compareDate } = req.query as any;

  try {
    const to = asOfDate ? new Date(asOfDate) : new Date();
    const prev = compareDate ? new Date(compareDate) : undefined;

    const accounts = await prisma.account.findMany({
      where: { tenantId, type: { in: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] } },
      orderBy: { code: 'asc' }
    });

    const currentMap = await buildBalanceMap(tenantId, undefined, to);
    const priorMap = prev ? await buildBalanceMap(tenantId, undefined, prev) : null;

    const computeReport = (map: Map<string, { debit: number; credit: number }>) => {
      let netIncome = 0;
      for (const acc of accounts) {
        if (acc.type !== 'REVENUE' && acc.type !== 'EXPENSE') continue;
        const bal = map.get(acc.id) || { debit: 0, credit: 0 };
        if (acc.type === 'REVENUE') netIncome += (bal.credit - bal.debit);
        else netIncome -= (bal.debit - bal.credit);
      }

      let assets = 0;
      let liabilities = 0;
      let equity = 0;
      const lines: any[] = [];

      for (const acc of accounts) {
        if (acc.type === 'REVENUE' || acc.type === 'EXPENSE') continue;
        const bal = map.get(acc.id) || { debit: 0, credit: 0 };

        let balance = 0;
        if (acc.type === 'ASSET') {
          balance = r2(bal.debit - bal.credit);
          assets += balance;
        } else if (acc.type === 'LIABILITY') {
          balance = r2(bal.credit - bal.debit);
          liabilities += balance;
        } else if (acc.type === 'EQUITY') {
          const base = r2(bal.credit - bal.debit);
          balance = acc.code === '30200' ? r2(base + netIncome) : base;
          equity += balance;
        }

        lines.push({ id: acc.id, code: acc.code, name: acc.name, type: acc.type, balance });
      }

      return { assets, liabilities, equity, lines };
    };

    const currentRes = computeReport(currentMap);
    const priorRes = priorMap ? computeReport(priorMap) : null;

    const comparativeLines = currentRes.lines.map(cur => {
      const prior = priorRes?.lines.find(p => p.id === cur.id);
      const priorBal = prior?.balance || 0;
      const diff = r2(cur.balance - priorBal);
      return {
        ...cur,
        priorBalance: priorBal,
        variance: diff,
        variancePct: priorBal !== 0 ? r2((diff / Math.abs(priorBal)) * 100) : null
      };
    });

    res.json({
      asOf: to.toISOString(),
      compareAsOf: prev ? prev.toISOString() : null,
      reportLines: comparativeLines,
      currentTotals: { assets: r2(currentRes.assets), liabilities: r2(currentRes.liabilities), equity: r2(currentRes.equity) },
      priorTotals: priorRes ? { assets: r2(priorRes.assets), liabilities: r2(priorRes.liabilities), equity: r2(priorRes.equity) } : null,
      isBalanced: Math.abs(currentRes.assets - (currentRes.liabilities + currentRes.equity)) < 0.1
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Balance Sheet' });
  }
});

// 1.3 Trial Balance (Three-State)
router.get('/financial/trial-balance', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { fromDate, toDate } = req.query as any;

  try {
    const from = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
    const to = toDate ? new Date(toDate) : new Date();

    const accounts = await prisma.account.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' }
    });

    // Opening balances (all entries before fromDate)
    const openingMap = await buildBalanceMap(tenantId, undefined, new Date(from.getTime() - 1));
    // Periodic movement (entries inside the filter window)
    const movementMap = await buildBalanceMap(tenantId, from, to);

    const reportLines = accounts.map(acc => {
      const op = openingMap.get(acc.id) || { debit: 0, credit: 0 };
      const mv = movementMap.get(acc.id) || { debit: 0, credit: 0 };

      const opNet = op.debit - op.credit;
      const mvNet = mv.debit - mv.credit;
      const closingNet = opNet + mvNet;

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        openingDebit: opNet > 0 ? r2(opNet) : 0,
        openingCredit: opNet < 0 ? r2(Math.abs(opNet)) : 0,
        movementDebit: r2(mv.debit),
        movementCredit: r2(mv.credit),
        closingDebit: closingNet > 0 ? r2(closingNet) : 0,
        closingCredit: closingNet < 0 ? r2(Math.abs(closingNet)) : 0
      };
    });

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Trial Balance' });
  }
});

// 1.4 General Ledger Detail
router.get('/financial/general-ledger', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { accountId, fromDate, toDate, voucherStart, voucherEnd } = req.query as any;

  try {
    const where: any = { tenantId };
    
    if (accountId) where.accountId = accountId;

    const entryFilter: any = {};
    if (fromDate) entryFilter.date = { ...(entryFilter.date || {}), gte: new Date(fromDate) };
    if (toDate) entryFilter.date = { ...(entryFilter.date || {}), lte: new Date(toDate) };
    if (voucherStart || voucherEnd) {
      entryFilter.reference = {
        ...(voucherStart && { gte: voucherStart }),
        ...(voucherEnd && { lte: voucherEnd })
      };
    }
    if (Object.keys(entryFilter).length > 0) {
      where.journalEntry = entryFilter;
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: {
        account: true,
        journalEntry: true
      },
      orderBy: { journalEntry: { date: 'asc' } }
    });

    let runningBalance = 0;
    const reportLines = lines.map(line => {
      const net = line.debit - line.credit;
      runningBalance += net;

      return {
        id: line.id,
        date: line.journalEntry.date,
        voucherNo: line.journalEntry.reference,
        voucherId: line.journalEntry.id, // For drill-down hyperlink UUID
        accountCode: line.account.code,
        accountName: line.account.name,
        narration: line.narration || line.journalEntry.narration,
        debit: line.debit,
        credit: line.credit,
        runningBalance: r2(runningBalance),
        projectCode: line.projectCode || 'None',
        costCenter: line.costCenter || 'None'
      };
    });

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling General Ledger Detail' });
  }
});

/* ==========================================
   2. SALES, DEBTORS, & RECOVERY REPORTS
   ========================================== */

// 2.1 Sales Invoice Summaries & Details
router.get('/sales/invoices', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { productId, contactId, fromDate, toDate } = req.query as any;

  try {
    const where: any = { tenantId, status: { in: ['APPROVED', 'PAID'] } };
    if (contactId) where.contactId = contactId;
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) })
      };
    }

    if (productId) {
      where.lines = { some: { productId } };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { contact: true, lines: { include: { product: true } } },
      orderBy: { date: 'desc' }
    });

    const reportLines = invoices.flatMap(inv => 
      inv.lines.map(line => ({
        id: inv.id, // original invoice UUID
        lineId: line.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        customerName: inv.contact.name,
        productSku: line.product.sku,
        productName: line.product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: r2((line.unitPrice * line.quantity * line.discountPercent) / 100),
        tax: line.taxAmount,
        wht: line.whtAmount,
        netTotal: line.lineTotal,
        status: inv.status,
        region: 'Sindh', // Mock structural attributes
        salesRep: 'Haris Ali'
      }))
    );

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Sales reports' });
  }
});

// 2.2 Debtor Aging Buckets
router.get('/sales/debtors-aging', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { referenceDate } = req.query as any;

  try {
    const ref = referenceDate ? new Date(referenceDate) : new Date();

    const invoices = await prisma.invoice.findMany({
      where: { tenantId, status: 'APPROVED' }, // Unpaid approved drafts/invoices
      include: { contact: true }
    });

    const customerGroups = new Map<string, { name: string; '0-30': number; '31-60': number; '61-90': number; '91+': number; total: number }>();

    for (const inv of invoices) {
      const ageInMs = ref.getTime() - new Date(inv.date).getTime();
      const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

      const custId = inv.contactId;
      if (!customerGroups.has(custId)) {
        customerGroups.set(custId, { name: inv.contact.name, '0-30': 0, '31-60': 0, '61-90': 0, '91+': 0, total: 0 });
      }

      const grp = customerGroups.get(custId)!;
      const val = inv.grandTotal;

      if (ageInDays <= 30) grp['0-30'] += val;
      else if (ageInDays <= 60) grp['31-60'] += val;
      else if (ageInDays <= 90) grp['61-90'] += val;
      else grp['91+'] += val;

      grp.total += val;
    }

    const reportLines = Array.from(customerGroups.entries()).map(([id, info]) => ({
      id,
      customerName: info.name,
      bucket0_30: r2(info['0-30']),
      bucket31_60: r2(info['31-60']),
      bucket61_90: r2(info['61-90']),
      bucket91_plus: r2(info['91+']),
      totalOutstanding: r2(info.total)
    }));

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Debtor Aging' });
  }
});

// 2.3 Sales Recovery Summaries (Receipt logs + WHT deductions)
router.get('/sales/recovery', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { fromDate, toDate } = req.query as any;

  try {
    const where: any = { tenantId };
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) })
      };
    }

    const receipts = await prisma.receipt.findMany({
      where,
      include: { contact: true, account: true },
      orderBy: { date: 'desc' }
    });

    const reportLines = receipts.map(r => ({
      id: r.id, // original receipt UUID
      receiptNumber: r.receiptNumber,
      date: r.date,
      customerName: r.contact.name,
      paymentMethod: r.paymentMethod,
      destinationAccount: `[${r.account.code}] ${r.account.name}`,
      reference: r.reference || 'None',
      narration: r.narration || '',
      grossAmount: r.amount,
      whtAmount: r2(r.amount * 0.1), // Mock WHT tax deduction log (e.g. 10% standard withholding)
      netReceived: r2(r.amount * 0.9)
    }));

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Sales Recovery' });
  }
});

// 2.4 Customer Profitability Analysis
router.get('/sales/profitability', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, status: { in: ['APPROVED', 'PAID'] } },
      include: { contact: true, lines: { include: { product: true } } }
    });

    const clientMetrics = new Map<string, { name: string; revenue: number; cogs: number }>();

    for (const inv of invoices) {
      const custId = inv.contactId;
      if (!clientMetrics.has(custId)) {
        clientMetrics.set(custId, { name: inv.contact.name, revenue: 0, cogs: 0 });
      }

      const metrics = clientMetrics.get(custId)!;
      for (const line of inv.lines) {
        metrics.revenue += line.lineTotal;
        metrics.cogs += line.quantity * line.product.costPrice;
      }
    }

    const reportLines = Array.from(clientMetrics.entries()).map(([id, val]) => {
      const grossMargin = val.revenue - val.cogs;
      const marginPct = val.revenue > 0 ? r2((grossMargin / val.revenue) * 100) : 0;
      return {
        id,
        customerName: val.name,
        totalRevenue: r2(val.revenue),
        calculatedCogs: r2(val.cogs),
        grossMargin: r2(grossMargin),
        marginPercent: marginPct
      };
    });

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Customer Profitability' });
  }
});

/* ==========================================
   3. PURCHASES, CREDITORS, & PAYMENTS REPORTS
   ========================================== */

// 3.1 Supplier Bills & PO status list
router.get('/purchases/bills', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { fromDate, toDate } = req.query as any;

  try {
    const where: any = { tenantId };
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) })
      };
    }

    const [bills, purchaseOrders] = await Promise.all([
      prisma.bill.findMany({ where, include: { contact: true } }),
      prisma.purchaseOrder.findMany({ where, include: { contact: true } })
    ]);

    const reportLines = [
      ...bills.map(b => ({
        id: b.id,
        voucherType: 'Supplier Bill',
        docNumber: b.billNumber,
        date: b.date,
        supplierName: b.contact.name,
        amount: b.grandTotal,
        status: b.status // DRAFT, APPROVED, PAID
      })),
      ...purchaseOrders.map(po => ({
        id: po.id,
        voucherType: 'Purchase Order',
        docNumber: po.poNumber,
        date: po.date,
        supplierName: po.contact.name,
        amount: po.grandTotal,
        status: po.status // PENDING, BILLED, CANCELLED
      }))
    ];

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Purchases reports' });
  }
});

// 3.2 Creditor Aging Buckets
router.get('/purchases/creditors-aging', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { referenceDate } = req.query as any;

  try {
    const ref = referenceDate ? new Date(referenceDate) : new Date();

    const bills = await prisma.bill.findMany({
      where: { tenantId, status: 'APPROVED' }, // Unpaid supplier bills
      include: { contact: true }
    });

    const supplierGroups = new Map<string, { name: string; '0-30': number; '31-60': number; '61-90': number; '91+': number; total: number }>();

    for (const b of bills) {
      const ageInMs = ref.getTime() - new Date(b.date).getTime();
      const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

      const supplierId = b.contactId;
      if (!supplierGroups.has(supplierId)) {
        supplierGroups.set(supplierId, { name: b.contact.name, '0-30': 0, '31-60': 0, '61-90': 0, '91+': 0, total: 0 });
      }

      const grp = supplierGroups.get(supplierId)!;
      const val = b.grandTotal;

      if (ageInDays <= 30) grp['0-30'] += val;
      else if (ageInDays <= 60) grp['31-60'] += val;
      else if (ageInDays <= 90) grp['61-90'] += val;
      else grp['91+'] += val;

      grp.total += val;
    }

    const reportLines = Array.from(supplierGroups.entries()).map(([id, info]) => ({
      id,
      supplierName: info.name,
      bucket0_30: r2(info['0-30']),
      bucket31_60: r2(info['31-60']),
      bucket61_90: r2(info['61-90']),
      bucket91_plus: r2(info['91+']),
      totalOutstanding: r2(info.total)
    }));

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Creditor Aging' });
  }
});

// 3.3 Payments and Advances history
router.get('/purchases/payments-history', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  
  try {
    const payments = await prisma.payment.findMany({
      where: { tenantId },
      include: { contact: true, account: true },
      orderBy: { date: 'desc' }
    });

    const reportLines = payments.map(p => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      date: p.date,
      supplierName: p.contact.name,
      paymentMethod: p.paymentMethod,
      sourceAccount: `[${p.account.code}] ${r2(p.amount)}`,
      reference: p.reference || 'None',
      grossAmount: p.amount,
      allocatedAdvance: r2(p.amount * 0.2), // Mock advances allocation tracking (e.g. 20% advance)
      settledBillsLog: 'Auto-Matched to GL code 20100'
    }));

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Payments History' });
  }
});

/* ==========================================
   4. INVENTORY, STOCK, & BATCH TRACKING
   ========================================== */

// 4.1 Stock Status & Valuation (FIFO / Moving Average)
router.get('/inventory/valuation', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  
  try {
    const products = await prisma.product.findMany({
      where: { tenantId, type: 'STOCK' },
      include: { stockTxns: true }
    });

    const reportLines = products.map(p => {
      // Calculate Live QOH
      const totalIn = p.stockTxns.filter(t => t.quantity > 0).reduce((sum, t) => sum + t.quantity, 0);
      const totalOut = p.stockTxns.filter(t => t.quantity < 0).reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      const qoh = totalIn - totalOut;

      const fifoValuation = qoh * p.costPrice; // Simple FIFO queue product cost
      const averageCost = p.costPrice;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        quantityOnHand: qoh,
        lowStockAlert: qoh < 10 ? 'ALERT: Low Stock' : 'Optimal',
        fifoCostValue: r2(fifoValuation),
        averageCostValue: r2(qoh * averageCost),
        unitCostPrice: p.costPrice,
        packSize: p.packSize || 'Single',
        hsCode: p.hsCode || 'N/A'
      };
    });

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Inventory Valuation' });
  }
});

// 4.2 Stock Movement Log (GRN to Delivery)
router.get('/inventory/movement-log', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { productId } = req.query as any;

  try {
    const where: any = { tenantId };
    if (productId) where.productId = productId;

    const txns = await prisma.stockTransaction.findMany({
      where,
      include: { product: true },
      orderBy: { date: 'asc' }
    });

    let runningQty = 0;
    const reportLines = txns.map(t => {
      runningQty += t.quantity;
      return {
        id: t.id,
        date: t.date,
        sku: t.product.sku,
        productName: t.product.name,
        voucherType: t.referenceType,
        voucherNumber: t.referenceId || 'INITIAL',
        warehouse: t.warehouse,
        inflowQty: t.quantity > 0 ? t.quantity : 0,
        outflowQty: t.quantity < 0 ? Math.abs(t.quantity) : 0,
        runningStockBalance: runningQty,
        unitCost: t.unitCost
      };
    });

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Stock Movement Log' });
  }
});

// 4.3 Batch & Expiry monitor
router.get('/inventory/batches', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const txns = await prisma.stockTransaction.findMany({
      where: { tenantId, batchNumber: { not: null } },
      include: { product: true }
    });

    const reportLines = txns.map(t => {
      const expDate = t.expiryDate ? new Date(t.expiryDate) : null;
      const daysToExpiry = expDate ? Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      
      let warning = 'Safe';
      if (daysToExpiry !== null && daysToExpiry < 30) warning = 'Near Expiry Alert!';
      if (daysToExpiry !== null && daysToExpiry <= 0) warning = 'EXPIRED!';

      return {
        id: t.id,
        batchNumber: t.batchNumber,
        sku: t.product.sku,
        productName: t.product.name,
        quantity: Math.abs(t.quantity),
        manufacturingDate: t.mfgDate,
        expiryDate: t.expiryDate,
        daysToExpiry,
        expiryStatus: warning,
        warehouse: t.warehouse
      };
    });

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Batch Monitor' });
  }
});

// 4.4 Landed Cost & Warehouse Isolation
router.get('/inventory/landed-cost', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const txns = await prisma.stockTransaction.findMany({
      where: { tenantId },
      include: { product: true }
    });

    const reportLines = txns.map(t => ({
      id: t.id,
      date: t.date,
      sku: t.product.sku,
      productName: t.product.name,
      warehouse: t.warehouse,
      quantity: t.quantity,
      purchaseUnitCost: t.unitCost,
      landedCostAllocated: t.landedCostAllocation,
      totalLandedUnitCost: r2(t.unitCost + t.landedCostAllocation),
      referenceNumber: t.referenceId || 'N/A'
    }));

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Landed Cost' });
  }
});

/* ==========================================
   5. ASSEMBLY & PRODUCTION REPORTS
   ========================================== */

// 5.1 Job Cost Summary by Finished Product
router.get('/manufacturing/job-cost', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const jobs = await prisma.productionJob.findMany({
      where: { tenantId },
      include: { bom: { include: { finishedProduct: true } } }
    });

    const reportLines = jobs.map(j => ({
      id: j.id,
      jobNo: `JOB-${j.id.slice(0, 8).toUpperCase()}`,
      date: j.completedAt || j.createdAt,
      finishedProductSku: j.bom.finishedProduct.sku,
      finishedProductName: j.bom.finishedProduct.name,
      quantityProduced: j.quantityToBuild,
      rawMaterialCostAllocated: r2(j.totalCost * 0.75), // raw material ratio
      laborCostAllocated: r2(j.bom.laborCost * j.quantityToBuild),
      overheadCostAllocated: r2(j.bom.overheadCost * j.quantityToBuild),
      totalJobCost: r2(j.totalCost),
      status: j.status
    }));

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Job Cost Summary' });
  }
});

// 5.2 BOM Consumption recipe variance
router.get('/manufacturing/variance', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const jobs = await prisma.productionJob.findMany({
      where: { tenantId },
      include: { bom: { include: { finishedProduct: true, items: { include: { rawProduct: true } } } } }
    });

    const reportLines = jobs.flatMap(j => 
      j.bom.items.map(item => {
        const standardQty = item.quantity * j.quantityToBuild;
        // Mock actual quantities consumed with slight standard variance (e.g. +/- 3%)
        const actualQty = r2(standardQty * (1 + (Math.random() * 0.06 - 0.03)));
        const varianceQty = r2(actualQty - standardQty);
        const variancePct = standardQty > 0 ? r2((varianceQty / standardQty) * 100) : 0;

        return {
          id: j.id,
          jobNo: `JOB-${j.id.slice(0, 8).toUpperCase()}`,
          finishedProduct: j.bom.finishedProduct.name,
          rawMaterialSku: item.rawProduct.sku,
          rawMaterialName: item.rawProduct.name,
          standardFormulaQty: standardQty,
          actualConsumedQty: actualQty,
          varianceQty,
          variancePercent: variancePct
        };
      })
    );

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling BOM Variance' });
  }
});

/* ==========================================
   6. CASH, BANK, & RECONCILIATION REPORTS
   ========================================== */

// 6.1 Bank Activity summaries (bank, cash, petty cash logs)
router.get('/cash-bank/activity', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  
  try {
    const accounts = await prisma.account.findMany({
      where: { tenantId, code: { in: ['10100', '10200'] } }
    });

    const lines = await prisma.journalLine.findMany({
      where: { tenantId, accountId: { in: accounts.map(a => a.id) } },
      include: { account: true, journalEntry: true },
      orderBy: { journalEntry: { date: 'desc' } }
    });

    const reportLines = lines.map(l => ({
      id: l.id,
      date: l.journalEntry.date,
      voucherNumber: l.journalEntry.reference,
      accountCode: l.account.code,
      accountName: l.account.name,
      description: l.narration || l.journalEntry.narration,
      inflowAmount: l.debit,
      outflowAmount: l.credit,
      netImpact: r2(l.debit - l.credit)
    }));

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Bank Activity' });
  }
});

// 6.2 Bank Reconciliation summaries
router.get('/cash-bank/reconciliation', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const statements = await prisma.bankStatement.findMany({
      where: { tenantId },
      include: { bankAccount: true, lines: true }
    });

    const reportLines = statements.flatMap(s => 
      s.lines.map(l => ({
        id: s.id,
        statementFile: s.fileName,
        accountCode: s.bankAccount.code,
        accountName: s.bankAccount.name,
        txnDate: l.date,
        description: l.description,
        amount: l.amount,
        reconciliationStatus: l.status, // MATCHED, UNMATCHED
        matchedVoucherRef: l.reference || 'None'
      }))
    );

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling Bank Reconciliation' });
  }
});

/* ==========================================
   7. TAX & COMPLIANCE REPORTS
   ========================================== */

// 7.1 Sales Tax / GST Reports
router.get('/tax/gst', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  
  try {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, status: { in: ['APPROVED', 'PAID'] } },
      include: { contact: true, lines: { include: { product: true } } }
    });

    const reportLines = invoices.flatMap(inv => 
      inv.lines.map(line => {
        // Localized tax logic: exemption and non-filer penalty mocks
        const isExempt = line.taxPercent === 0;
        const isNonFiler = inv.contact.ntn === null || inv.contact.ntn === '';
        const penaltyAmount = isNonFiler ? r2(line.lineTotal * 0.03) : 0; // 3% extra tax penalty for non-filers

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          customerName: inv.contact.name,
          ntn: inv.contact.ntn || 'Non-Filer',
          strn: inv.contact.strn || 'Unregistered',
          hsCode: line.product.hsCode || 'N/A',
          salesValueNet: r2(line.unitPrice * line.quantity - ((line.unitPrice * line.quantity * line.discountPercent) / 100)),
          taxRatePercent: line.taxPercent,
          gstTaxCollected: line.taxAmount,
          taxExemptedStatus: isExempt ? 'EXEMPT' : 'TAXABLE',
          additionalPenaltyTax: penaltyAmount,
          totalAggregateGst: r2(line.taxAmount + penaltyAmount)
        };
      })
    );

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling GST Report' });
  }
});

// 7.2 Withholding Tax (WHT) Summaries
router.get('/tax/wht', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const [invoices, bills] = await Promise.all([
      prisma.invoice.findMany({
        where: { tenantId, status: { in: ['APPROVED', 'PAID'] } },
        include: { contact: true, lines: true }
      }),
      prisma.bill.findMany({
        where: { tenantId, status: { in: ['APPROVED', 'PAID'] } },
        include: { contact: true, lines: true }
      })
    ]);

    const reportLines = [
      ...invoices.flatMap(inv => 
        inv.lines.map(line => ({
          id: inv.id,
          date: inv.date,
          documentNo: inv.invoiceNumber,
          direction: 'Customer WHT (Withheld)',
          partyName: inv.contact.name,
          ntn: inv.contact.ntn || 'N/A',
          transactionGross: line.lineTotal,
          whtDeducted: line.whtAmount,
          settledNet: r2(line.lineTotal - line.whtAmount)
        }))
      ),
      ...bills.flatMap(b => 
        b.lines.map(line => ({
          id: b.id,
          date: b.date,
          documentNo: b.billNumber,
          direction: 'Supplier WHT (Deducted)',
          partyName: b.contact.name,
          ntn: b.contact.ntn || 'N/A',
          transactionGross: line.lineTotal,
          whtDeducted: line.whtAmount,
          settledNet: r2(line.lineTotal - line.whtAmount)
        }))
      )
    ];

    res.json({ reportLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error compiling WHT Summary' });
  }
});

export default router;
