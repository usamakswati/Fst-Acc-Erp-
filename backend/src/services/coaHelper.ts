import { prisma } from '../db';

export async function createDefaultCoA(tenantId: string, txClient?: any): Promise<void> {
  const db = txClient || prisma;
  
  const standardAccounts = [
    // Assets
    { code: '10100', name: 'Cash in Hand', type: 'ASSET' },
    { code: '10200', name: 'Bank Current Account', type: 'ASSET' },
    { code: '12100', name: 'Accounts Receivable (AR)', type: 'ASSET' },
    { code: '13100', name: 'Inventory (Stock Asset)', type: 'ASSET' },
    // Liabilities
    { code: '20100', name: 'Accounts Payable (AP)', type: 'LIABILITY' },
    { code: '21100', name: 'Tax Payable (GST/VAT)', type: 'LIABILITY' },
    // Equity
    { code: '30100', name: 'Share Capital', type: 'EQUITY' },
    { code: '30200', name: 'Retained Earnings', type: 'EQUITY' },
    // Revenue
    { code: '40100', name: 'Sales Revenue', type: 'REVENUE' },
    // Expenses
    { code: '50100', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE' },
    { code: '50200', name: 'Direct Labor Expense', type: 'EXPENSE' },
    { code: '50300', name: 'Manufacturing Overheads', type: 'EXPENSE' },
    { code: '50400', name: 'General & Administrative Expense', type: 'EXPENSE' },
  ];

  for (const acc of standardAccounts) {
    const existing = await db.account.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: acc.code,
        },
      },
    });

    if (!existing) {
      await db.account.create({
        data: {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          tenantId,
        },
      });
    }
  }
}
