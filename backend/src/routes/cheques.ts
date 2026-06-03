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

// GET /api/cheques - Get all PDCs
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const cheques = await prisma.postDatedCheque.findMany({
      where: { tenantId },
      include: {
        contact: true,
        account: true,
      },
      orderBy: { chequeDate: 'asc' },
    });

    res.json(cheques);
  } catch (error) {
    console.error('Error fetching PDCs:', error);
    res.status(500).json({ error: 'Error fetching post dated cheques' });
  }
});

// POST /api/cheques - Record a new PDC and write pending ledger entry
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { chequeNumber, contactId, accountId, chequeDate, amount, bankName } = req.body;

  if (!chequeNumber || !contactId || !accountId || !chequeDate || !amount || !bankName) {
    return res.status(400).json({ error: 'Invalid cheque details' });
  }

  try {
    const cheque = await prisma.$transaction(async (tx) => {
      // Check unique chequeNumber
      const existing = await tx.postDatedCheque.findUnique({
        where: {
          tenantId_chequeNumber: { tenantId, chequeNumber }
        }
      });

      if (existing) {
        throw new Error(`Cheque number ${chequeNumber} already exists`);
      }

      // Ensure PDC asset account (12200) exists
      const pdcAccount = await getOrCreatePdcAccount(
        tenantId,
        '12200',
        'Post Dated Cheques Held',
        'ASSET',
        tx
      );

      // Fetch Accounts Receivable (12100)
      const arAccount = await tx.account.findFirst({
        where: { tenantId, code: '12100' },
      });
      if (!arAccount) {
        throw new Error('Accounts Receivable account [Code: 12100] is missing from Chart of Accounts');
      }

      // 1. Create PostDatedCheque record
      const chq = await tx.postDatedCheque.create({
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

      // 2. Post Journal Entry for PENDING cheque
      // Debit: PDC Held (12200)
      // Credit: Accounts Receivable (12100)
      await tx.journalEntry.create({
        data: {
          tenantId,
          date: new Date(),
          reference: `PDC-REC-${chequeNumber}`,
          narration: `Record Post Dated Cheque received: Cheque #${chequeNumber} (${bankName})`,
          createdByUserId: req.user!.id,
          lines: {
            create: [
              {
                tenantId,
                accountId: pdcAccount.id,
                debit: parseFloat(amount),
                credit: 0,
                narration: `PDC Received PENDING: Cheque #${chequeNumber}`,
              },
              {
                tenantId,
                accountId: arAccount.id,
                debit: 0,
                credit: parseFloat(amount),
                narration: `Accounts Receivable credit from received PDC: Cheque #${chequeNumber}`,
              },
            ],
          },
        },
      });

      return chq;
    });

    res.status(201).json(cheque);
  } catch (error: any) {
    console.error('Error creating PDC:', error);
    res.status(400).json({ error: error.message || 'Error recording post dated cheque' });
  }
});

// POST /api/cheques/:id/clear - Clear cheque and post to ledger via Receipt
router.post('/:id/clear', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cheque = await tx.postDatedCheque.findUnique({
        where: { id, tenantId },
      });

      if (!cheque) {
        throw new Error('Cheque not found');
      }

      if (cheque.status !== 'PENDING') {
        throw new Error(`Cheque is already ${cheque.status}`);
      }

      // 1. Mark cheque as CLEARED
      const updatedCheque = await tx.postDatedCheque.update({
        where: { id },
        data: { status: 'CLEARED' },
      });

      // Ensure PDC asset account (12200) exists
      const pdcAccount = await getOrCreatePdcAccount(
        tenantId,
        '12200',
        'Post Dated Cheques Held',
        'ASSET',
        tx
      );

      // 2. Create customer payment Receipt
      const receiptNumber = `RCP-PDC-${cheque.chequeNumber}`;
      
      const receipt = await tx.receipt.create({
        data: {
          tenantId,
          receiptNumber,
          contactId: cheque.contactId,
          accountId: cheque.accountId,
          date: new Date(),
          amount: cheque.amount,
          paymentMethod: 'CHEQUE',
          reference: `Clearance of PDC Cheque #${cheque.chequeNumber} (${cheque.bankName})`,
          narration: `Post dated cheque clearance for Cheque #${cheque.chequeNumber}`,
          status: 'APPROVED',
        }
      });

      // 3. Create Ledger Postings
      // Debit: Bank Account (cheque.accountId)
      // Credit: PDC Held (12200)
      const journalLines = [
        {
          tenantId,
          accountId: cheque.accountId, // Bank
          debit: cheque.amount,
          credit: 0,
          narration: `PDC Cleared: Cheque #${cheque.chequeNumber} (${cheque.bankName})`,
        },
        {
          tenantId,
          accountId: pdcAccount.id, // PDC Held (12200)
          debit: 0,
          credit: cheque.amount,
          narration: `PDC asset clearance: Cheque #${cheque.chequeNumber}`,
        }
      ];

      await tx.journalEntry.create({
        data: {
          tenantId,
          date: new Date(),
          reference: receiptNumber,
          narration: `Auto-generated posting for PDC clearance: Cheque #${cheque.chequeNumber}`,
          createdByUserId,
          lines: {
            create: journalLines,
          },
        },
      });

      return { cheque: updatedCheque, receipt };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error clearing PDC:', error);
    res.status(500).json({ error: error.message || 'Error clearing cheque' });
  }
});

// POST /api/cheques/:id/bounce - Mark cheque as BOUNCED and reverse ledger posting
router.post('/:id/bounce', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cheque = await tx.postDatedCheque.findUnique({
        where: { id, tenantId },
      });

      if (!cheque) {
        throw new Error('Cheque not found');
      }

      if (cheque.status !== 'PENDING') {
        throw new Error(`Cheque is already ${cheque.status}`);
      }

      // 1. Mark cheque as BOUNCED
      const updatedCheque = await tx.postDatedCheque.update({
        where: { id },
        data: { status: 'BOUNCED' },
      });

      // Ensure PDC asset account (12200) exists
      const pdcAccount = await getOrCreatePdcAccount(
        tenantId,
        '12200',
        'Post Dated Cheques Held',
        'ASSET',
        tx
      );

      // Fetch Accounts Receivable (12100)
      const arAccount = await tx.account.findFirst({
        where: { tenantId, code: '12100' },
      });
      if (!arAccount) {
        throw new Error('Accounts Receivable account [Code: 12100] is missing from Chart of Accounts');
      }

      // 2. Post Reversal Ledger Entries
      // Debit: Accounts Receivable (12100)
      // Credit: PDC Held (12200)
      await tx.journalEntry.create({
        data: {
          tenantId,
          date: new Date(),
          reference: `PDC-BNC-${cheque.chequeNumber}`,
          narration: `Reversal entry for Bounced PDC: Cheque #${cheque.chequeNumber}`,
          createdByUserId,
          lines: {
            create: [
              {
                tenantId,
                accountId: arAccount.id,
                debit: cheque.amount,
                credit: 0,
                narration: `Accounts Receivable debit from bounced PDC: Cheque #${cheque.chequeNumber}`,
              },
              {
                tenantId,
                accountId: pdcAccount.id,
                debit: 0,
                credit: cheque.amount,
                narration: `PDC Held asset clearance from bounce: Cheque #${cheque.chequeNumber}`,
              },
            ],
          },
        },
      });

      return updatedCheque;
    });

    res.json({ success: true, cheque: result });
  } catch (error: any) {
    console.error('Error bouncing PDC:', error);
    res.status(500).json({ error: error.message || 'Error bouncing cheque' });
  }
});

export default router;
