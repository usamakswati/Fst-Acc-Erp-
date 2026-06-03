import { Router } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// Helper to ensure PDC account exists in Chart of Accounts
async function getOrCreatePdcAccount(tenantId: string, code: string, name: string, type: string, tx: any) {
  let acc = await tx.account.findUnique({
    where: {
      tenantId_code: { tenantId, code },
    },
  });
  if (!acc) {
    acc = await tx.account.create({
      data: {
        tenantId,
        code,
        name,
        type,
      },
    });
  }
  return acc;
}

// GET /api/vendor-cheques - Fetch all issued cheques
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const cheques = await prisma.postDatedChequeIssued.findMany({
      where: { tenantId },
      include: {
        contact: true,
        account: true,
      },
      orderBy: { chequeDate: 'asc' },
    });

    res.json(cheques);
  } catch (error) {
    console.error('Error fetching PDCs issued:', error);
    res.status(500).json({ error: 'Error fetching post dated cheques issued' });
  }
});

// POST /api/vendor-cheques - Record a new issued cheque and write pending ledger entry
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { chequeNumber, contactId, accountId, chequeDate, amount, bankName } = req.body;

  if (!chequeNumber || !contactId || !accountId || !chequeDate || !amount || !bankName) {
    return res.status(400).json({ error: 'Invalid cheque details' });
  }

  try {
    const cheque = await prisma.$transaction(async (tx) => {
      // Check unique chequeNumber
      const existing = await tx.postDatedChequeIssued.findUnique({
        where: {
          tenantId_chequeNumber: { tenantId, chequeNumber }
        }
      });

      if (existing) {
        throw new Error(`Cheque number ${chequeNumber} already exists`);
      }

      // Ensure PDC liability account (20200) exists
      const pdcAccount = await getOrCreatePdcAccount(
        tenantId,
        '20200',
        'Post Dated Cheques Issued',
        'LIABILITY',
        tx
      );

      // Fetch Accounts Payable (20100)
      const apAccount = await tx.account.findFirst({
        where: { tenantId, code: '20100' },
      });
      if (!apAccount) {
        throw new Error('Accounts Payable account [Code: 20100] is missing from Chart of Accounts');
      }

      // 1. Create PostDatedChequeIssued record
      const chq = await tx.postDatedChequeIssued.create({
        data: {
          tenantId,
          chequeNumber,
          contactId,
          accountId,
          chequeDate: new Date(chequeDate),
          amount: parseFloat(amount),
          bankName,
          status: 'PENDING',
        },
        include: {
          contact: true,
          account: true,
        }
      });

      // 2. Post Journal Entry for PENDING issued cheque
      // Debit: Accounts Payable (20100)
      // Credit: PDC Issued (20200)
      await tx.journalEntry.create({
        data: {
          tenantId,
          date: new Date(),
          reference: `PDC-ISS-${chequeNumber}`,
          narration: `Record Post Dated Cheque issued: Cheque #${chequeNumber} to supplier`,
          createdByUserId: req.user!.id,
          lines: {
            create: [
              {
                tenantId,
                accountId: apAccount.id,
                debit: parseFloat(amount),
                credit: 0,
                narration: `Accounts Payable debit from issued PDC: Cheque #${chequeNumber}`,
              },
              {
                tenantId,
                accountId: pdcAccount.id,
                debit: 0,
                credit: parseFloat(amount),
                narration: `PDC Issued PENDING liability: Cheque #${chequeNumber}`,
              },
            ],
          },
        },
      });

      return chq;
    });

    res.status(201).json(cheque);
  } catch (error: any) {
    console.error('Error creating PDC issued:', error);
    res.status(400).json({ error: error.message || 'Error recording post dated cheque issued' });
  }
});

// POST /api/vendor-cheques/:id/clear - Clear issued cheque and post to general ledger
router.post('/:id/clear', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cheque = await tx.postDatedChequeIssued.findUnique({
        where: { id, tenantId },
      });

      if (!cheque) {
        throw new Error('Cheque not found');
      }

      if (cheque.status !== 'PENDING') {
        throw new Error(`Cheque is already ${cheque.status}`);
      }

      // 1. Mark cheque as CLEARED
      const updatedCheque = await tx.postDatedChequeIssued.update({
        where: { id },
        data: { status: 'CLEARED' },
      });

      // Ensure PDC liability account (20200) exists
      const pdcAccount = await getOrCreatePdcAccount(
        tenantId,
        '20200',
        'Post Dated Cheques Issued',
        'LIABILITY',
        tx
      );

      // 2. Create vendor payment
      const paymentNumber = `PMT-PDC-${cheque.chequeNumber}`;
      
      const payment = await tx.payment.create({
        data: {
          tenantId,
          paymentNumber,
          contactId: cheque.contactId,
          accountId: cheque.accountId,
          date: new Date(),
          amount: cheque.amount,
          paymentMethod: 'CHEQUE',
          reference: `Clearance of Issued PDC Cheque #${cheque.chequeNumber} (${cheque.bankName})`,
          narration: `Issued post dated cheque clearance for Cheque #${cheque.chequeNumber}`,
          status: 'APPROVED',
        }
      });

      // 3. Create Ledger Postings
      // Debit: PDC Issued liability (20200)
      // Credit: Bank Account (cheque.accountId)
      const journalLines = [
        {
          tenantId,
          accountId: pdcAccount.id, // PDC Issued liability (20200)
          debit: cheque.amount,
          credit: 0,
          narration: `PDC liability clearance: Cheque #${cheque.chequeNumber}`,
        },
        {
          tenantId,
          accountId: cheque.accountId, // Bank
          debit: 0,
          credit: cheque.amount,
          narration: `Issued PDC Cleared: Cheque #${cheque.chequeNumber} (${cheque.bankName})`,
        }
      ];

      await tx.journalEntry.create({
        data: {
          tenantId,
          date: new Date(),
          reference: paymentNumber,
          narration: `Auto-generated posting for clearing issued Cheque #${cheque.chequeNumber}`,
          createdByUserId,
          lines: {
            create: journalLines,
          },
        },
      });

      return { cheque: updatedCheque, payment };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error clearing issued PDC:', error);
    res.status(500).json({ error: error.message || 'Error clearing cheque' });
  }
});

// POST /api/vendor-cheques/:id/bounce - Bounce issued cheque and reverse ledger posting
router.post('/:id/bounce', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cheque = await tx.postDatedChequeIssued.findUnique({
        where: { id, tenantId },
      });

      if (!cheque) {
        throw new Error('Cheque not found');
      }

      if (cheque.status !== 'PENDING') {
        throw new Error(`Cheque is already ${cheque.status}`);
      }

      // 1. Mark cheque as BOUNCED
      const updatedCheque = await tx.postDatedChequeIssued.update({
        where: { id },
        data: { status: 'BOUNCED' },
      });

      // Ensure PDC liability account (20200) exists
      const pdcAccount = await getOrCreatePdcAccount(
        tenantId,
        '20200',
        'Post Dated Cheques Issued',
        'LIABILITY',
        tx
      );

      // Fetch Accounts Payable (20100)
      const apAccount = await tx.account.findFirst({
        where: { tenantId, code: '20100' },
      });
      if (!apAccount) {
        throw new Error('Accounts Payable account [Code: 20100] is missing from Chart of Accounts');
      }

      // 2. Post Reversal Ledger Entries
      // Debit: PDC Issued (20200)
      // Credit: Accounts Payable (20100)
      await tx.journalEntry.create({
        data: {
          tenantId,
          date: new Date(),
          reference: `PDC-BNC-${cheque.chequeNumber}`,
          narration: `Reversal entry for Bounced issued PDC: Cheque #${cheque.chequeNumber}`,
          createdByUserId,
          lines: {
            create: [
              {
                tenantId,
                accountId: pdcAccount.id,
                debit: cheque.amount,
                credit: 0,
                narration: `PDC liability clearance from bounce: Cheque #${cheque.chequeNumber}`,
              },
              {
                tenantId,
                accountId: apAccount.id,
                debit: 0,
                credit: cheque.amount,
                narration: `Accounts Payable credit from bounced PDC: Cheque #${cheque.chequeNumber}`,
              },
            ],
          },
        },
      });

      return updatedCheque;
    });

    res.json({ success: true, cheque: result });
  } catch (error: any) {
    console.error('Error bouncing issued PDC:', error);
    res.status(500).json({ error: error.message || 'Error bouncing cheque' });
  }
});

export default router;
