import { recordStockOutflow, recordStockInflow } from './inventory';

/**
 * Automatically generates balanced ledger postings for an approved sales invoice.
 * Must run inside a Prisma transaction client (tx).
 */
export async function postInvoiceToLedger(
  tenantId: string,
  invoiceId: string,
  createdByUserId: string,
  tx: any
): Promise<void> {
  // 1. Fetch invoice with details
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId, tenantId },
    include: {
      lines: {
        include: { product: true },
      },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status === 'APPROVED' || invoice.status === 'PAID') {
    throw new Error('Invoice has already been posted to the ledger');
  }

  // 2. Fetch required accounts
  const accountCodes = {
    ar: '12100',        // Accounts Receivable
    sales: '40100',     // Sales Revenue
    tax: '21100',       // Tax Payable
    cogs: '50100',      // Cost of Goods Sold
    inventory: '13100'  // Inventory (Stock Asset)
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

  const arAccount = getAccount(accountCodes.ar);
  const salesAccount = getAccount(accountCodes.sales);
  const taxAccount = getAccount(accountCodes.tax);
  const cogsAccount = getAccount(accountCodes.cogs);
  const inventoryAccount = getAccount(accountCodes.inventory);

  // 3. Process stock outflows and calculate COGS
  let totalCOGS = 0;

  for (const line of invoice.lines) {
    if (line.product.type === 'STOCK') {
      // Record inventory deduction and calculate cost
      const valuation = await recordStockOutflow(
        tenantId,
        line.productId,
        line.quantity,
        'INVOICE',
        invoice.id,
        tx
      );
      totalCOGS += valuation.totalCOGS;
    }
  }

  // 4. Construct journal lines
  const journalLinesData: any[] = [];

  // Determine Debit Account: use paymentAccountId for POS cash sales, otherwise AR Account
  const debitAccountId = invoice.isPos && invoice.paymentAccountId 
    ? invoice.paymentAccountId 
    : arAccount.id;
  
  const debitNarration = invoice.isPos 
    ? `POS Cash/Bank receipt posting for Invoice ${invoice.invoiceNumber}` 
    : `Accounts Receivable posting for Invoice ${invoice.invoiceNumber}`;

  // Debit posting
  journalLinesData.push({
    tenantId,
    accountId: debitAccountId,
    debit: invoice.grandTotal,
    credit: 0.0,
    narration: debitNarration,
  });

  // Sales Credit (Net Revenue)
  const netSalesRevenue = invoice.subTotal - invoice.discountTotal;
  journalLinesData.push({
    tenantId,
    accountId: salesAccount.id,
    debit: 0.0,
    credit: netSalesRevenue,
    narration: `Sales Revenue posting for Invoice ${invoice.invoiceNumber}`,
  });

  // Tax Credit (Tax Liability)
  if (invoice.taxTotal > 0) {
    journalLinesData.push({
      tenantId,
      accountId: taxAccount.id,
      debit: 0.0,
      credit: invoice.taxTotal,
      narration: `Tax Payable posting for Invoice ${invoice.invoiceNumber}`,
    });
  }

  // COGS & Inventory Adjustments (only if COGS > 0)
  if (totalCOGS > 0) {
    // COGS Debit (Expense)
    journalLinesData.push({
      tenantId,
      accountId: cogsAccount.id,
      debit: totalCOGS,
      credit: 0.0,
      narration: `Cost of Goods Sold posting for Invoice ${invoice.invoiceNumber}`,
    });

    // Inventory Credit (Asset)
    journalLinesData.push({
      tenantId,
      accountId: inventoryAccount.id,
      debit: 0.0,
      credit: totalCOGS,
      narration: `Inventory asset adjustment for Invoice ${invoice.invoiceNumber}`,
    });
  }

  // 5. Create Journal Entry
  const journalEntry = await tx.journalEntry.create({
    data: {
      tenantId,
      date: invoice.date,
      reference: invoice.invoiceNumber,
      narration: `Auto-generated posting for approved Sales Invoice ${invoice.invoiceNumber}`,
      createdByUserId,
      lines: {
        create: journalLinesData,
      },
    },
  });

  // 6. Update Invoice Status to APPROVED
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { status: 'APPROVED' },
  });

  console.log(`Successfully posted Invoice ${invoice.invoiceNumber} to General Ledger. Journal Entry ID: ${journalEntry.id}`);
}

/**
 * Automatically generates balanced ledger postings for an approved supplier bill.
 * Also receives stock items and triggers cost average revaluation.
 * Must run inside a Prisma transaction client (tx).
 */
export async function postBillToLedger(
  tenantId: string,
  billId: string,
  createdByUserId: string,
  tx: any
): Promise<void> {
  // 1. Fetch bill with details
  const bill = await tx.bill.findUnique({
    where: { id: billId, tenantId },
    include: {
      lines: {
        include: { product: true },
      },
    },
  });

  if (!bill) {
    throw new Error('Bill not found');
  }

  if (bill.status === 'APPROVED' || bill.status === 'PAID') {
    throw new Error('Bill has already been posted to the ledger');
  }

  // 2. Fetch required accounts
  const accountCodes = {
    ap: '20100',         // Accounts Payable
    tax: '21100',        // Tax Payable (input tax)
    inventory: '13100',  // Inventory (Stock Asset)
    expense: '50400'     // G&A Expense (for non-stock purchases)
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

  const apAccount = getAccount(accountCodes.ap);
  const taxAccount = getAccount(accountCodes.tax);
  const inventoryAccount = getAccount(accountCodes.inventory);
  const expenseAccount = getAccount(accountCodes.expense);

  // 3. Process stock inflows and calculate totals
  let totalStockDebit = 0;
  let totalExpenseDebit = 0;

  for (const line of bill.lines) {
    const lineDiscount = (line.quantity * line.unitCost) * (line.discountPercent / 100);
    const lineNet = (line.quantity * line.unitCost) - lineDiscount;

    if (line.product.type === 'STOCK') {
      // Record stock inflow & calculate valuation (WEIGHTED AVG / FIFO)
      const netUnitCost = line.unitCost * (1 - line.discountPercent / 100);
      await recordStockInflow(
        tenantId,
        line.productId,
        line.quantity,
        netUnitCost,
        'BILL',
        bill.id,
        tx
      );
      totalStockDebit += lineNet;
    } else {
      totalExpenseDebit += lineNet;
    }
  }

  // 4. Construct journal lines
  const journalLinesData: any[] = [];

  // AP Credit (Accounts Payable liability increases)
  journalLinesData.push({
    tenantId,
    accountId: apAccount.id,
    debit: 0.0,
    credit: bill.grandTotal,
    narration: `Accounts Payable posting for Bill ${bill.billNumber}`,
  });

  // Tax Debit (Input Tax reducing overall tax liability - debit normal)
  if (bill.taxTotal > 0) {
    journalLinesData.push({
      tenantId,
      accountId: taxAccount.id,
      debit: bill.taxTotal,
      credit: 0.0,
      narration: `Input Tax posting for Bill ${bill.billNumber}`,
    });
  }

  // Inventory Asset Debit
  if (totalStockDebit > 0) {
    journalLinesData.push({
      tenantId,
      accountId: inventoryAccount.id,
      debit: totalStockDebit,
      credit: 0.0,
      narration: `Stock receipt posting for Bill ${bill.billNumber}`,
    });
  }

  // G&A Expense Debit
  if (totalExpenseDebit > 0) {
    journalLinesData.push({
      tenantId,
      accountId: expenseAccount.id,
      debit: totalExpenseDebit,
      credit: 0.0,
      narration: `Operating expense purchase posting for Bill ${bill.billNumber}`,
    });
  }

  // 5. Create Journal Entry
  const journalEntry = await tx.journalEntry.create({
    data: {
      tenantId,
      date: bill.date,
      reference: bill.billNumber,
      narration: `Auto-generated posting for approved Supplier Bill ${bill.billNumber}`,
      createdByUserId,
      lines: {
        create: journalLinesData,
      },
    },
  });

  // 6. Update Bill Status to APPROVED
  await tx.bill.update({
    where: { id: billId },
    data: { status: 'APPROVED' },
  });

  console.log(`Successfully posted Bill ${bill.billNumber} to General Ledger. Journal Entry ID: ${journalEntry.id}`);
}

