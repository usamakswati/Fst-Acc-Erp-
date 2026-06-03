import { Router } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/receipts - Fetch all customer receipts
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const receipts = await prisma.receipt.findMany({
      where: { tenantId },
      include: {
        contact: true,
        account: true,
      },
      orderBy: { date: 'desc' },
    });

    res.json(receipts);
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Error fetching receipts' });
  }
});

// POST /api/receipts - Record a new receipt and post to general ledger
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { receiptNumber, contactId, accountId, date, amount, paymentMethod, reference, narration } = req.body;

  if (!receiptNumber || !contactId || !accountId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid receipt details' });
  }

  // Check unique receipt number
  const existing = await prisma.receipt.findUnique({
    where: {
      tenantId_receiptNumber: { tenantId, receiptNumber }
    }
  });

  if (existing) {
    return res.status(400).json({ error: `Receipt number ${receiptNumber} already exists` });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify destination account (Cash/Bank)
      const debitAccount = await tx.account.findUnique({
        where: { id: accountId, tenantId },
      });

      if (!debitAccount) {
        throw new Error('Destination ledger account not found');
      }

      // 2. Fetch Accounts Receivable (AR) account code "12100"
      const arAccount = await tx.account.findFirst({
        where: { tenantId, code: '12100' },
      });

      if (!arAccount) {
        throw new Error('Accounts Receivable account [Code: 12100] is missing from Chart of Accounts');
      }

      // 3. Create Receipt
      const receipt = await tx.receipt.create({
        data: {
          tenantId,
          receiptNumber,
          contactId,
          accountId,
          date: date ? new Date(date) : new Date(),
          amount: parseFloat(amount),
          paymentMethod,
          reference: reference || null,
          narration: narration || null,
          status: 'APPROVED',
        },
        include: {
          contact: true,
          account: true,
        }
      });

      // 4. Post Journal Entry
      const journalLines = [
        // Debit: Cash/Bank Account
        {
          tenantId,
          accountId: debitAccount.id,
          debit: parseFloat(amount),
          credit: 0,
          narration: `Payment received via ${paymentMethod}. Receipt: ${receiptNumber}`,
        },
        // Credit: Accounts Receivable
        {
          tenantId,
          accountId: arAccount.id,
          debit: 0,
          credit: parseFloat(amount),
          narration: `Accounts Receivable credit from customer receipt: ${receiptNumber}`,
        }
      ];

      await tx.journalEntry.create({
        data: {
          tenantId,
          date: receipt.date,
          reference: receiptNumber,
          narration: narration || `Auto-generated posting for customer receipt ${receiptNumber}`,
          createdByUserId,
          lines: {
            create: journalLines,
          },
        },
      });

      return receipt;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Receipt creation error:', error);
    res.status(500).json({ error: error.message || 'Error recording customer receipt' });
  }
});

export default router;
