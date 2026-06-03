import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply auth and tenant isolation middlewares to all routes
router.use(authenticateJWT);
router.use(requireTenant);

/**
 * 1. Import CSV Bank Statement
 * Expected JSON payload:
 * {
 *   bankAccountId: string,
 *   fileName: string,
 *   csvText: string
 * }
 */
router.post('/import', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bankAccountId, fileName, csvText } = req.body;
    const tenantId = req.tenantId!;

    if (!bankAccountId || !fileName || !csvText) {
       res.status(400).json({ error: 'Missing bankAccountId, fileName, or csvText.' });
       return;
    }

    // Verify bank account exists and belongs to tenant
    const bankAccount = await prisma.account.findFirst({
      where: { id: bankAccountId, tenantId },
    });

    if (!bankAccount) {
       res.status(404).json({ error: 'Bank Account not found.' });
       return;
    }

    // Parse CSV Text
    // Expected headers: Date, Description, Amount, Reference (optional)
    const lines = csvText.split('\n').map((line: string) => line.trim()).filter(Boolean);
    if (lines.length <= 1) {
       res.status(400).json({ error: 'CSV file must contain a header and at least one transaction row.' });
       return;
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const dateIdx = headers.indexOf('date');
    const descIdx = headers.indexOf('description');
    const amountIdx = headers.indexOf('amount');
    const refIdx = headers.indexOf('reference');

    if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
       res.status(400).json({ 
        error: 'CSV headers must include "Date", "Description", and "Amount". (Found: ' + lines[0] + ')' 
      });
       return;
    }

    const parsedLines: Array<{
      date: Date;
      description: string;
      amount: number;
      reference?: string;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((val: string) => val.trim());
      // Handle simple CSV escaping or missing columns
      if (row.length < Math.max(dateIdx, descIdx, amountIdx) + 1) {
        continue; // skip malformed lines
      }

      const dateStr = row[dateIdx];
      const desc = row[descIdx];
      const amtStr = row[amountIdx];
      const ref = refIdx !== -1 ? row[refIdx] : '';

      const dateVal = new Date(dateStr);
      const amtVal = parseFloat(amtStr);

      if (isNaN(dateVal.getTime()) || isNaN(amtVal)) {
        // Skip rows with invalid date or amount
        continue;
      }

      parsedLines.push({
        date: dateVal,
        description: desc,
        amount: amtVal,
        reference: ref || undefined,
      });
    }

    if (parsedLines.length === 0) {
       res.status(400).json({ error: 'No valid transaction records could be parsed from the CSV.' });
       return;
    }

    // Create BankStatement and BankStatementLines in a transaction
    const statement = await prisma.$transaction(async (tx) => {
      const bs = await tx.bankStatement.create({
        data: {
          tenantId,
          fileName,
          bankAccountId,
          status: 'PENDING',
        },
      });

      await tx.bankStatementLine.createMany({
        data: parsedLines.map((line) => ({
          statementId: bs.id,
          date: line.date,
          description: line.description,
          amount: line.amount,
          reference: line.reference,
          status: 'UNMATCHED',
        })),
      });

      return bs;
    });

     res.status(201).json(statement);
  } catch (error: any) {
    console.error('Import Statement Error:', error);
     res.status(500).json({ error: error.message || 'Internal server error importing bank statement' });
  }
});

/**
 * 2. Get Statements List
 */
router.get('/statements', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const statements = await prisma.bankStatement.findMany({
      where: { tenantId },
      include: {
        bankAccount: true,
        _count: {
          select: { lines: true },
        },
      },
      orderBy: { importDate: 'desc' },
    });

     res.json(statements);
  } catch (error: any) {
     res.status(500).json({ error: error.message || 'Error fetching statements' });
  }
});

/**
 * 3. Get Single Statement Details + Search Candidates
 */
router.get('/statements/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const statement = await prisma.bankStatement.findFirst({
      where: { id, tenantId },
      include: {
        bankAccount: true,
        lines: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!statement) {
       res.status(404).json({ error: 'Statement not found.' });
       return;
    }

    // Enhance lines with potential match candidates
    const enhancedLines = await Promise.all(
      statement.lines.map(async (line) => {
        if (line.status === 'MATCHED') {
          // Fetch matched details
          let matchDetail = null;
          if (line.matchedTransactionType === 'INVOICE') {
            matchDetail = await prisma.invoice.findFirst({
              where: { id: line.matchedTransactionId || '', tenantId },
              include: { contact: true },
            });
          } else if (line.matchedTransactionType === 'BILL') {
            matchDetail = await prisma.bill.findFirst({
              where: { id: line.matchedTransactionId || '', tenantId },
              include: { contact: true },
            });
          } else if (line.matchedTransactionType === 'JOURNAL') {
            matchDetail = await prisma.journalEntry.findFirst({
              where: { id: line.matchedTransactionId || '', tenantId },
            });
          }
          return {
            ...line,
            matchDetail,
            candidates: [],
          };
        }

        // Search candidates for unmatched lines
        const amt = line.amount;
        let candidates: any[] = [];

        if (amt > 0) {
          // Deposit matches: Unpaid/Approved Invoices where grandTotal = amt
          const matchingInvoices = await prisma.invoice.findMany({
            where: {
              tenantId,
              status: 'APPROVED',
              grandTotal: amt,
            },
            include: { contact: true },
          });

          candidates = matchingInvoices.map((inv) => ({
            id: inv.id,
            type: 'INVOICE',
            reference: inv.invoiceNumber,
            date: inv.date,
            contactName: inv.contact.name,
            amount: inv.grandTotal,
            description: `Sales Invoice ${inv.invoiceNumber} to ${inv.contact.name}`,
          }));
        } else {
          // Withdrawal matches: Unpaid/Approved Bills where grandTotal = abs(amt)
          const targetAmt = Math.abs(amt);
          const matchingBills = await prisma.bill.findMany({
            where: {
              tenantId,
              status: 'APPROVED',
              grandTotal: targetAmt,
            },
            include: { contact: true },
          });

          candidates = matchingBills.map((b) => ({
            id: b.id,
            type: 'BILL',
            reference: b.billNumber,
            date: b.date,
            contactName: b.contact.name,
            amount: b.grandTotal,
            description: `Supplier Bill ${b.billNumber} from ${b.contact.name}`,
          }));
        }

        return {
          ...line,
          candidates,
        };
      })
    );

     res.json({
      ...statement,
      lines: enhancedLines,
    });
  } catch (error: any) {
    console.error('Fetch statement error:', error);
     res.status(500).json({ error: error.message || 'Error fetching statement details' });
  }
});

/**
 * 4. Match Statement Line
 * Expected Payload:
 * {
 *   lineId: string,
 *   targetType: 'INVOICE' | 'BILL' | 'JOURNAL',
 *   targetId: string
 * }
 */
router.post('/match', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lineId, targetType, targetId } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user?.id || '';

    if (!lineId || !targetType || !targetId) {
       res.status(400).json({ error: 'Missing lineId, targetType, or targetId.' });
       return;
    }

    const line = await prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { statement: true },
    });

    if (!line || line.statement.tenantId !== tenantId) {
       res.status(404).json({ error: 'Bank statement line not found.' });
       return;
    }

    if (line.status === 'MATCHED') {
       res.status(400).json({ error: 'Line is already matched.' });
       return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Process matches based on transaction type
      if (targetType === 'INVOICE') {
        const invoice = await tx.invoice.findFirst({
          where: { id: targetId, tenantId, status: 'APPROVED' },
        });
        if (!invoice) throw new Error('Invoice not found or already paid.');

        // Update Invoice Status
        await tx.invoice.update({
          where: { id: targetId },
          data: { status: 'PAID' },
        });

        // Post Cash Receipt Journal Entry
        // DR Bank Account (bankAccountId from BankStatement), CR Accounts Receivable (12100)
        const arAccount = await tx.account.findFirst({
          where: { tenantId, code: '12100' },
        });
        if (!arAccount) throw new Error('AR Account (12100) not found in COA.');

        await tx.journalEntry.create({
          data: {
            tenantId,
            reference: `REC-${invoice.invoiceNumber}`,
            narration: `Bank Reconciliation Match Payment for Sales Invoice ${invoice.invoiceNumber}`,
            createdByUserId: userId,
            lines: {
              create: [
                {
                  tenantId,
                  accountId: line.statement.bankAccountId, // DR Bank Account
                  debit: line.amount,
                  credit: 0,
                  narration: `Receipt matching for Invoice ${invoice.invoiceNumber}`,
                },
                {
                  tenantId,
                  accountId: arAccount.id, // CR AR Account
                  debit: 0,
                  credit: line.amount,
                  narration: `Clearing AR for Invoice ${invoice.invoiceNumber}`,
                },
              ],
            },
          },
        });

      } else if (targetType === 'BILL') {
        const bill = await tx.bill.findFirst({
          where: { id: targetId, tenantId, status: 'APPROVED' },
        });
        if (!bill) throw new Error('Supplier Bill not found or already paid.');

        // Update Bill Status
        await tx.bill.update({
          where: { id: targetId },
          data: { status: 'PAID' },
        });

        // Post Cash Disbursement Journal Entry
        // DR Accounts Payable (20100), CR Bank Account (bankAccountId)
        const apAccount = await tx.account.findFirst({
          where: { tenantId, code: '20100' },
        });
        if (!apAccount) throw new Error('AP Account (20100) not found in COA.');

        const absoluteAmt = Math.abs(line.amount);

        await tx.journalEntry.create({
          data: {
            tenantId,
            reference: `PAY-${bill.billNumber}`,
            narration: `Bank Reconciliation Match Payment for Supplier Bill ${bill.billNumber}`,
            createdByUserId: userId,
            lines: {
              create: [
                {
                  tenantId,
                  accountId: apAccount.id, // DR AP Account
                  debit: absoluteAmt,
                  credit: 0,
                  narration: `Disbursement matching for Bill ${bill.billNumber}`,
                },
                {
                  tenantId,
                  accountId: line.statement.bankAccountId, // CR Bank Account
                  debit: 0,
                  credit: absoluteAmt,
                  narration: `Clearing AP for Bill ${bill.billNumber}`,
                },
              ],
            },
          },
        });
      }

      // 2. Mark line as MATCHED
      await tx.bankStatementLine.update({
        where: { id: lineId },
        data: {
          status: 'MATCHED',
          matchedTransactionId: targetId,
          matchedTransactionType: targetType,
        },
      });

      // 3. If all lines of statement are matched, set statement status to COMPLETED
      const remainingUnmatched = await tx.bankStatementLine.count({
        where: {
          statementId: line.statementId,
          status: 'UNMATCHED',
        },
      });

      if (remainingUnmatched === 0) {
        await tx.bankStatement.update({
          where: { id: line.statementId },
          data: { status: 'COMPLETED' },
        });
      }
    });

     res.json({ success: true, message: 'Line reconciled and ledger postings booked.' });
  } catch (error: any) {
    console.error('Match error:', error);
     res.status(500).json({ error: error.message || 'Error executing match transaction' });
  }
});

/**
 * 5. Create New Ledger Posting & Match Immediately (e.g. Bank fees, direct interest)
 * Expected Payload:
 * {
 *   lineId: string,
 *   offsetAccountId: string, // The offset GL account (e.g. 50400 for G&A expenses bank fees)
 *   reference: string
 * }
 */
router.post('/create-match', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lineId, offsetAccountId, reference } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.user?.id || '';

    if (!lineId || !offsetAccountId) {
       res.status(400).json({ error: 'Missing lineId or offsetAccountId.' });
       return;
    }

    const line = await prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { statement: true },
    });

    if (!line || line.statement.tenantId !== tenantId) {
       res.status(404).json({ error: 'Bank statement line not found.' });
       return;
    }

    if (line.status === 'MATCHED') {
       res.status(400).json({ error: 'Line is already matched.' });
       return;
    }

    const offsetAccount = await prisma.account.findFirst({
      where: { id: offsetAccountId, tenantId },
    });

    if (!offsetAccount) {
       res.status(404).json({ error: 'Offset Account not found.' });
       return;
    }

    await prisma.$transaction(async (tx) => {
      const amount = line.amount;
      const isDeposit = amount > 0;
      const absoluteAmt = Math.abs(amount);

      // Create new Journal Entry representing direct bank payment
      await tx.journalEntry.create({
        data: {
          tenantId,
          reference: reference || 'BANK-RECON',
          narration: `Direct Bank Reconciliation Posting: ${line.description}`,
          createdByUserId: userId,
          lines: {
            create: isDeposit 
              ? [
                  {
                    tenantId,
                    accountId: line.statement.bankAccountId, // DR Bank Account
                    debit: absoluteAmt,
                    credit: 0,
                    narration: `Direct bank deposit matching: ${line.description}`,
                  },
                  {
                    tenantId,
                    accountId: offsetAccountId, // CR Offset Account (Revenue, etc.)
                    debit: 0,
                    credit: absoluteAmt,
                    narration: `Offsetting entry: ${line.description}`,
                  }
                ]
              : [
                  {
                    tenantId,
                    accountId: offsetAccountId, // DR Expense Account (Bank fees, etc.)
                    debit: absoluteAmt,
                    credit: 0,
                    narration: `Direct bank withdrawal matching: ${line.description}`,
                  },
                  {
                    tenantId,
                    accountId: line.statement.bankAccountId, // CR Bank Account
                    debit: 0,
                    credit: absoluteAmt,
                    narration: `Offsetting entry: ${line.description}`,
                  }
                ]
          }
        },
      });

      // Mark line as MATCHED
      // For direct posting, we will link it to the newly created journal entry ID in status step
      const createdEntry = await tx.journalEntry.findFirst({
        where: { tenantId, reference: reference || 'BANK-RECON', narration: `Direct Bank Reconciliation Posting: ${line.description}` },
        orderBy: { createdAt: 'desc' }
      });

      await tx.bankStatementLine.update({
        where: { id: lineId },
        data: {
          status: 'MATCHED',
          matchedTransactionId: createdEntry?.id || null,
          matchedTransactionType: 'JOURNAL',
        },
      });

      // Update statement completion status
      const remainingUnmatched = await tx.bankStatementLine.count({
        where: {
          statementId: line.statementId,
          status: 'UNMATCHED',
        },
      });

      if (remainingUnmatched === 0) {
        await tx.bankStatement.update({
          where: { id: line.statementId },
          data: { status: 'COMPLETED' },
        });
      }
    });

     res.json({ success: true, message: 'New transaction booked and line reconciled.' });
  } catch (error: any) {
    console.error('Create-match error:', error);
     res.status(500).json({ error: error.message || 'Error creating reconciliation match.' });
  }
});

/**
 * 6. Unmatch Reconciled Line
 */
router.post('/unmatch', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lineId } = req.body;
    const tenantId = req.tenantId!;

    const line = await prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { statement: true },
    });

    if (!line || line.statement.tenantId !== tenantId) {
       res.status(404).json({ error: 'Line not found.' });
       return;
    }

    if (line.status === 'UNMATCHED') {
       res.status(400).json({ error: 'Line is already unmatched.' });
       return;
    }

    await prisma.$transaction(async (tx) => {
      // Revert states
      if (line.matchedTransactionType === 'INVOICE') {
        // Mark Invoice back to APPROVED
        await tx.invoice.update({
          where: { id: line.matchedTransactionId || '' },
          data: { status: 'APPROVED' },
        });

        // Delete payment journal entry
        const matchInv = await tx.invoice.findUnique({
          where: { id: line.matchedTransactionId || '' }
        });
        if (matchInv) {
          const entry = await tx.journalEntry.findFirst({
            where: { tenantId, reference: `REC-${matchInv.invoiceNumber}` }
          });
          if (entry) {
            await tx.journalLine.deleteMany({ where: { journalEntryId: entry.id } });
            await tx.journalEntry.delete({ where: { id: entry.id } });
          }
        }

      } else if (line.matchedTransactionType === 'BILL') {
        // Mark Bill back to APPROVED
        await tx.bill.update({
          where: { id: line.matchedTransactionId || '' },
          data: { status: 'APPROVED' },
        });

        // Delete payment journal entry
        const matchBill = await tx.bill.findUnique({
          where: { id: line.matchedTransactionId || '' }
        });
        if (matchBill) {
          const entry = await tx.journalEntry.findFirst({
            where: { tenantId, reference: `PAY-${matchBill.billNumber}` }
          });
          if (entry) {
            await tx.journalLine.deleteMany({ where: { journalEntryId: entry.id } });
            await tx.journalEntry.delete({ where: { id: entry.id } });
          }
        }

      } else if (line.matchedTransactionType === 'JOURNAL') {
        // For direct postings, delete the created Journal Entry entirely
        const entryId = line.matchedTransactionId || '';
        await tx.journalLine.deleteMany({ where: { journalEntryId: entryId } });
        await tx.journalEntry.delete({ where: { id: entryId } });
      }

      // Update line status
      await tx.bankStatementLine.update({
        where: { id: lineId },
        data: {
          status: 'UNMATCHED',
          matchedTransactionId: null,
          matchedTransactionType: null,
        },
      });

      // Mark statement back to PENDING
      await tx.bankStatement.update({
        where: { id: line.statementId },
        data: { status: 'PENDING' },
      });
    });

     res.json({ success: true, message: 'Line unmatched. Invoice/Bill reverted and postings removed.' });
  } catch (error: any) {
    console.error('Unmatch error:', error);
     res.status(500).json({ error: error.message || 'Error unmatching reconciliation line' });
  }
});

export default router;
