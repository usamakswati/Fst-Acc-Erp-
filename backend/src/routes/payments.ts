import { Router } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/payments - Fetch all payments
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const payments = await prisma.payment.findMany({
      where: { tenantId },
      include: {
        contact: true,
        account: true,
      },
      orderBy: { date: 'desc' },
    });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Error fetching vendor payments' });
  }
});

// POST /api/payments - Record vendor payment and post to general ledger
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { paymentNumber, contactId, accountId, date, amount, paymentMethod, reference, narration } = req.body;

  if (!paymentNumber || !contactId || !accountId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid payment details' });
  }

  // Check unique payment number
  const existing = await prisma.payment.findUnique({
    where: {
      tenantId_paymentNumber: { tenantId, paymentNumber }
    }
  });

  if (existing) {
    return res.status(400).json({ error: `Payment number ${paymentNumber} already exists` });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify credit account (Cash/Bank)
      const creditAccount = await tx.account.findUnique({
        where: { id: accountId, tenantId },
      });

      if (!creditAccount) {
        throw new Error('Cash/Bank ledger account not found');
      }

      // 2. Fetch Accounts Payable (AP) account code "20100"
      const apAccount = await tx.account.findFirst({
        where: { tenantId, code: '20100' },
      });

      if (!apAccount) {
        throw new Error('Accounts Payable account [Code: 20100] is missing from Chart of Accounts');
      }

      // 3. Create Payment
      const payment = await tx.payment.create({
        data: {
          tenantId,
          paymentNumber,
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
        // Debit: Accounts Payable (AP Liability decreases - debit normal)
        {
          tenantId,
          accountId: apAccount.id,
          debit: parseFloat(amount),
          credit: 0,
          narration: `Accounts Payable debit from payment: ${paymentNumber}`,
        },
        // Credit: Cash/Bank Account (Asset decreases - credit normal)
        {
          tenantId,
          accountId: creditAccount.id,
          debit: 0,
          credit: parseFloat(amount),
          narration: `Payment made via ${paymentMethod}. Reference: ${paymentNumber}`,
        }
      ];

      await tx.journalEntry.create({
        data: {
          tenantId,
          date: payment.date,
          reference: paymentNumber,
          narration: narration || `Auto-generated posting for supplier payment ${paymentNumber}`,
          createdByUserId,
          lines: {
            create: journalLines,
          },
        },
      });

      return payment;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: error.message || 'Error recording vendor payment' });
  }
});

export default router;
