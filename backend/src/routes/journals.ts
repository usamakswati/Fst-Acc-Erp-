import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/journals - Get all Journal Vouchers
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const entries = await prisma.journalEntry.findMany({
      where: { tenantId },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching Journal Vouchers' });
  }
});

// POST /api/journals - Create Manual Journal Voucher
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { date, reference, narration, lines } = req.body;

  // 1. Validation
  if (!lines || !Array.isArray(lines) || lines.length < 2) {
    return res.status(400).json({ error: 'A journal voucher must have at least 2 lines' });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const uniqueAccountIds = new Set<string>();

  for (const line of lines) {
    const debit = parseFloat(line.debit) || 0.0;
    const credit = parseFloat(line.credit) || 0.0;

    if (debit < 0 || credit < 0) {
      return res.status(400).json({ error: 'Debit and credit values cannot be negative' });
    }
    if (debit === 0 && credit === 0) {
      return res.status(400).json({ error: 'Each line must have either a debit or credit value' });
    }
    if (debit > 0 && credit > 0) {
      return res.status(400).json({ error: 'A single line cannot have both a debit and a credit value' });
    }
    if (!line.accountId) {
      return res.status(400).json({ error: 'Account selection is required for all lines' });
    }

    uniqueAccountIds.add(line.accountId);
    totalDebit += debit;
    totalCredit += credit;
  }

  // Check debit-credit equality (accounting for floating point differences)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({
      error: `Journal Voucher is unbalanced. Total Debits: ${totalDebit.toFixed(2)}, Total Credits: ${totalCredit.toFixed(2)}`,
    });
  }

  try {
    // Verify accounts exist for this tenant
    const accountsCount = await prisma.account.count({
      where: {
        tenantId,
        id: { in: Array.from(uniqueAccountIds) },
      },
    });

    if (accountsCount !== uniqueAccountIds.size) {
      return res.status(400).json({ error: 'One or more selected accounts are invalid' });
    }

    // Save balanced transaction
    const entry = await prisma.$transaction(async (tx) => {
      const createdEntry = await tx.journalEntry.create({
        data: {
          tenantId,
          date: date ? new Date(date) : new Date(),
          reference: reference || null,
          narration: narration || null,
          createdByUserId,
          lines: {
            create: lines.map((l: any) => ({
              tenantId,
              accountId: l.accountId,
              debit: parseFloat(l.debit) || 0.0,
              credit: parseFloat(l.credit) || 0.0,
              narration: l.narration || null,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      });

      return createdEntry;
    });

    res.status(201).json(entry);
  } catch (error: any) {
    console.error('JV creation error:', error);
    res.status(500).json({ error: 'Error saving Journal Voucher' });
  }
});

export default router;
