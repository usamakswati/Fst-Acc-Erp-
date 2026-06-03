import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply auth and tenant middlewares to all routes here
router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/coa - Fetch Chart of Accounts
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const accounts = await prisma.account.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });

    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching Chart of Accounts' });
  }
});

// GET /api/coa/trial-balance - Generate Real-time Trial Balance
router.get('/trial-balance', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const accounts = await prisma.account.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });

    const linesGrouped = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: { tenantId },
      _sum: { debit: true, credit: true },
    });

    const balanceMap = new Map<string, { debit: number; credit: number }>();
    for (const group of linesGrouped) {
      balanceMap.set(group.accountId, {
        debit: group._sum.debit || 0.0,
        credit: group._sum.credit || 0.0,
      });
    }

    const reportLines = accounts.map((acc) => {
      const totals = balanceMap.get(acc.id) || { debit: 0.0, credit: 0.0 };
      const net = totals.debit - totals.credit;

      let debitBalance = 0.0;
      let creditBalance = 0.0;

      if (net > 0) {
        debitBalance = net;
      } else if (net < 0) {
        creditBalance = Math.abs(net);
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        totalDebitLedger: totals.debit,
        totalCreditLedger: totals.credit,
        debitBalance: parseFloat(debitBalance.toFixed(2)),
        creditBalance: parseFloat(creditBalance.toFixed(2)),
      };
    });

    const totalDebits = reportLines.reduce((sum, line) => sum + line.debitBalance, 0);
    const totalCredits = reportLines.reduce((sum, line) => sum + line.creditBalance, 0);

    res.json({
      reportLines,
      totalDebits: parseFloat(totalDebits.toFixed(2)),
      totalCredits: parseFloat(totalCredits.toFixed(2)),
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    });
  } catch (error) {
    console.error('Trial balance calculation error:', error);
    res.status(500).json({ error: 'Error generating Trial Balance report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REPORTING ENGINE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build { accountId => { debit, credit } } filtered by tenant and date range */
async function buildBalanceMap(
  tenantId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<Map<string, { debit: number; credit: number }>> {
  const where: any = { tenantId };
  if (fromDate || toDate) {
    where.journalEntry = {
      ...(fromDate && { date: { gte: fromDate } }),
      ...(toDate   && { date: { lte: toDate } }),
    };
  }

  const linesGrouped = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where,
    _sum: { debit: true, credit: true },
  });

  const map = new Map<string, { debit: number; credit: number }>();
  for (const g of linesGrouped) {
    map.set(g.accountId, {
      debit:  g._sum.debit  ?? 0,
      credit: g._sum.credit ?? 0,
    });
  }
  return map;
}

/** Round to 2 decimal places */
const r2 = (n: number) => parseFloat(n.toFixed(2));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coa/profit-loss
// Query params: fromDate, toDate, comparePrevious (boolean string)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profit-loss', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const { fromDate: from, toDate: to, comparePrevious } = req.query as any;

    const fromDate = from ? new Date(from) : undefined;
    const toDate   = to   ? new Date(to)   : undefined;

    // Compute prior period (same duration, immediately before current window)
    let priorFromDate: Date | undefined;
    let priorToDate:   Date | undefined;
    if (comparePrevious === 'true' && fromDate && toDate) {
      const span    = toDate.getTime() - fromDate.getTime();
      priorToDate   = new Date(fromDate.getTime() - 1);
      priorFromDate = new Date(priorToDate.getTime() - span);
    }

    const accounts = await prisma.account.findMany({
      where: { tenantId, type: { in: ['REVENUE', 'EXPENSE'] } },
      orderBy: { code: 'asc' },
    });

    const [currentMap, priorMap] = await Promise.all([
      buildBalanceMap(tenantId, fromDate, toDate),
      priorFromDate
        ? buildBalanceMap(tenantId, priorFromDate, priorToDate)
        : Promise.resolve(new Map<string, { debit: number; credit: number }>()),
    ]);

    // Account group classification by code prefix
    const classify = (code: string): string => {
      if (code.startsWith('40')) return 'Sales Revenue';
      if (code.startsWith('41')) return 'Other Income';
      if (code === '50100')      return 'Cost of Sales';
      if (code.startsWith('50')) return 'Operating Expenses';
      return 'Other';
    };

    let totalRevenue     = 0;
    let totalOtherIncome = 0;
    let totalCOGS        = 0;
    let totalOpEx        = 0;

    const lines: any[] = [];

    for (const acc of accounts) {
      const cur  = currentMap.get(acc.id) ?? { debit: 0, credit: 0 };
      const prev = priorMap.get(acc.id)   ?? { debit: 0, credit: 0 };

      const balance      = acc.type === 'REVENUE'
        ? r2(cur.credit  - cur.debit)
        : r2(cur.debit   - cur.credit);
      const priorBalance = acc.type === 'REVENUE'
        ? r2(prev.credit - prev.debit)
        : r2(prev.debit  - prev.credit);

      const group    = classify(acc.code);
      const variance = r2(balance - priorBalance);
      const variancePct = priorBalance !== 0 ? r2(((balance - priorBalance) / Math.abs(priorBalance)) * 100) : null;

      if (acc.type === 'REVENUE') {
        if (group === 'Sales Revenue') totalRevenue     += balance;
        else                           totalOtherIncome += balance;
      } else {
        if (group === 'Cost of Sales') totalCOGS  += balance;
        else                           totalOpEx  += balance;
      }

      lines.push({ id: acc.id, code: acc.code, name: acc.name, type: acc.type, group, balance, priorBalance, variance, variancePct });
    }

    const grossProfit      = r2(totalRevenue - totalCOGS);
    const operatingProfit  = r2(grossProfit + totalOtherIncome - totalOpEx);
    const netIncome        = operatingProfit;
    const grossMarginPct   = totalRevenue > 0 ? r2((grossProfit / totalRevenue) * 100) : 0;
    const netMarginPct     = totalRevenue > 0 ? r2((netIncome   / totalRevenue) * 100) : 0;
    const costRatio        = totalRevenue > 0 ? r2((totalCOGS / totalRevenue)   * 100) : 0;
    const opexRatio        = totalRevenue > 0 ? r2((totalOpEx  / totalRevenue)  * 100) : 0;

    res.json({
      period:      { from: fromDate?.toISOString() ?? null, to: toDate?.toISOString() ?? null },
      hasPrior:    comparePrevious === 'true' && !!priorFromDate,
      priorPeriod: { from: priorFromDate?.toISOString() ?? null, to: priorToDate?.toISOString() ?? null },
      revenueLines:     lines.filter(l => l.type === 'REVENUE' && l.group === 'Sales Revenue'),
      otherIncomeLines: lines.filter(l => l.type === 'REVENUE' && l.group !== 'Sales Revenue'),
      cogsLines:        lines.filter(l => l.type === 'EXPENSE' && l.group === 'Cost of Sales'),
      opexLines:        lines.filter(l => l.type === 'EXPENSE' && l.group !== 'Cost of Sales'),
      totalRevenue:     r2(totalRevenue),
      totalOtherIncome: r2(totalOtherIncome),
      totalCOGS:        r2(totalCOGS),
      totalOpEx:        r2(totalOpEx),
      grossProfit,
      operatingProfit,
      netIncome,
      grossMarginPct,
      netMarginPct,
      costRatio,
      opexRatio,
    });
  } catch (error) {
    console.error('P&L error:', error);
    res.status(500).json({ error: 'Error generating Profit & Loss report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coa/balance-sheet
// Query params: asOfDate
// ─────────────────────────────────────────────────────────────────────────────
router.get('/balance-sheet', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const { asOfDate } = req.query as any;
    const toDate = asOfDate ? new Date(asOfDate) : undefined;

    const accounts   = await prisma.account.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
    const balanceMap = await buildBalanceMap(tenantId, undefined, toDate);

    // Compute Net Income by summing all Revenue and Expense accounts
    let netIncome = 0;
    for (const acc of accounts) {
      if (acc.type !== 'REVENUE' && acc.type !== 'EXPENSE') continue;
      const t = balanceMap.get(acc.id) ?? { debit: 0, credit: 0 };
      if (acc.type === 'REVENUE') netIncome += (t.credit - t.debit);
      else                        netIncome -= (t.debit  - t.credit);
    }

    const isCurrentAsset = (code: string) =>
      code.startsWith('101') || code.startsWith('102') ||
      code.startsWith('121') || code.startsWith('131');

    let totalCurrentAssets    = 0;
    let totalNonCurrentAssets = 0;
    let totalCurrentLiab      = 0;
    let totalNonCurrentLiab   = 0;
    let totalEquityBase       = 0;

    const currentAssets:    any[] = [];
    const nonCurrentAssets: any[] = [];
    const currentLiab:      any[] = [];
    const nonCurrentLiab:   any[] = [];
    const equityLines:      any[] = [];

    for (const acc of accounts) {
      const t = balanceMap.get(acc.id) ?? { debit: 0, credit: 0 };

      if (acc.type === 'ASSET') {
        const net = r2(t.debit - t.credit);
        if (isCurrentAsset(acc.code)) {
          totalCurrentAssets += net;
          currentAssets.push({ id: acc.id, code: acc.code, name: acc.name, balance: net, subGroup: 'Current Assets' });
        } else {
          totalNonCurrentAssets += net;
          nonCurrentAssets.push({ id: acc.id, code: acc.code, name: acc.name, balance: net, subGroup: 'Non-Current Assets' });
        }
      } else if (acc.type === 'LIABILITY') {
        const net = r2(t.credit - t.debit);
        if (parseInt(acc.code) < 21200) {
          totalCurrentLiab += net;
          currentLiab.push({ id: acc.id, code: acc.code, name: acc.name, balance: net, subGroup: 'Current Liabilities' });
        } else {
          totalNonCurrentLiab += net;
          nonCurrentLiab.push({ id: acc.id, code: acc.code, name: acc.name, balance: net, subGroup: 'Non-Current Liabilities' });
        }
      } else if (acc.type === 'EQUITY') {
        const net             = r2(t.credit - t.debit);
        const adjustedBalance = acc.code === '30200' ? r2(net + netIncome) : net;
        totalEquityBase += adjustedBalance;
        equityLines.push({ id: acc.id, code: acc.code, name: acc.name, balance: net, adjustedBalance, subGroup: 'Equity' });
      }
    }

    const totalAssets      = r2(totalCurrentAssets + totalNonCurrentAssets);
    const totalLiabilities = r2(totalCurrentLiab + totalNonCurrentLiab);
    const totalEquity      = r2(totalEquityBase);
    const totalLiabEquity  = r2(totalLiabilities + totalEquity);
    const isBalanced       = Math.abs(totalAssets - totalLiabEquity) < 0.01;

    // Working Capital = Current Assets - Current Liabilities
    const workingCapital   = r2(totalCurrentAssets - totalCurrentLiab);
    const currentRatio     = totalCurrentLiab > 0 ? r2(totalCurrentAssets / totalCurrentLiab) : null;
    const debtToEquity     = totalEquity > 0 ? r2(totalLiabilities / totalEquity) : null;

    res.json({
      asOf: toDate?.toISOString() ?? new Date().toISOString(),
      currentAssets,    totalCurrentAssets:    r2(totalCurrentAssets),
      nonCurrentAssets, totalNonCurrentAssets: r2(totalNonCurrentAssets),
      currentLiab,      totalCurrentLiab:      r2(totalCurrentLiab),
      nonCurrentLiab,   totalNonCurrentLiab:   r2(totalNonCurrentLiab),
      equityLines,
      netIncome:         r2(netIncome),
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabEquity,
      isBalanced,
      workingCapital,
      currentRatio,
      debtToEquity,
      // Legacy compat fields
      assetLines:     [...currentAssets, ...nonCurrentAssets],
      liabilityLines: [...currentLiab,   ...nonCurrentLiab],
    });
  } catch (error) {
    console.error('Balance sheet error:', error);
    res.status(500).json({ error: 'Error generating Balance Sheet report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coa/gst-summary
// Query params: fromDate, toDate
// ─────────────────────────────────────────────────────────────────────────────
router.get('/gst-summary', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const { fromDate: from, toDate: to } = req.query as any;
    const fromDate = from ? new Date(from) : undefined;
    const toDate   = to   ? new Date(to)   : undefined;

    const docWhere: any = { tenantId };
    if (fromDate) docWhere.date = { ...(docWhere.date || {}), gte: fromDate };
    if (toDate)   docWhere.date = { ...(docWhere.date || {}), lte: toDate };

    const [invoices, bills] = await Promise.all([
      prisma.invoice.findMany({
        where: { ...docWhere, status: { in: ['APPROVED', 'PAID'] } },
        select: { grandTotal: true, subTotal: true, discountTotal: true, taxTotal: true, invoiceNumber: true, date: true },
      }),
      prisma.bill.findMany({
        where: { ...docWhere, status: { in: ['APPROVED', 'PAID'] } },
        select: { grandTotal: true, subTotal: true, discountTotal: true, taxTotal: true, billNumber: true, date: true },
      }),
    ]);

    const totalOutputTax   = r2(invoices.reduce((s, i) => s + i.taxTotal, 0));
    const totalInputTax    = r2(bills.reduce((s, b)   => s + b.taxTotal, 0));
    const netGstPayable    = r2(totalOutputTax - totalInputTax);
    const totalSalesNet    = r2(invoices.reduce((s, i) => s + (i.subTotal - i.discountTotal), 0));
    const totalPurchaseNet = r2(bills.reduce((s, b)   => s + (b.subTotal - b.discountTotal), 0));

    res.json({
      period:          { from: fromDate?.toISOString() ?? null, to: toDate?.toISOString() ?? null },
      invoiceCount:    invoices.length,
      billCount:       bills.length,
      totalSalesNet,
      totalPurchaseNet,
      totalOutputTax,
      totalInputTax,
      netGstPayable,
      taxRate:         18,
      invoices: invoices.map(i => ({ ref: i.invoiceNumber, date: i.date, net: r2(i.subTotal - i.discountTotal), tax: i.taxTotal })),
      bills:    bills.map(b    => ({ ref: b.billNumber,    date: b.date, net: r2(b.subTotal - b.discountTotal), tax: b.taxTotal })),
    });
  } catch (error) {
    console.error('GST summary error:', error);
    res.status(500).json({ error: 'Error generating GST summary' });
  }
});

export default router;
