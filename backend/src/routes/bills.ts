import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';
import { postBillToLedger } from '../services/ledger';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/bills - Fetch all bills
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const bills = await prisma.bill.findMany({
      where: { tenantId },
      include: {
        contact: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching bills' });
  }
});

// GET /api/bills/:id - Fetch single bill with details
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    const bill = await prisma.bill.findUnique({
      where: { id, tenantId },
      include: {
        contact: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching bill details' });
  }
});

// POST /api/bills - Create a new supplier bill (Defaults to DRAFT status)
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { billNumber, contactId, date, dueDate, lines } = req.body;

  if (!billNumber || !contactId || !dueDate || !lines || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Invalid bill request details' });
  }

  // Double check bill number uniqueness for tenant
  const existing = await prisma.bill.findUnique({
    where: {
      tenantId_billNumber: { tenantId, billNumber },
    },
  });

  if (existing) {
    return res.status(400).json({ error: `Bill number ${billNumber} already exists` });
  }

  // Calculate totals and validate lines
  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  const validatedLines = [];

  for (const line of lines) {
    const quantity = parseFloat(line.quantity);
    const unitCost = parseFloat(line.unitCost);
    const discountPercent = parseFloat(line.discountPercent) || 0.0;
    const taxPercent = parseFloat(line.taxPercent) || 0.0;

    if (quantity <= 0 || unitCost < 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero and cost cannot be negative' });
    }
    if (discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({ error: 'Discount percent must be between 0 and 100' });
    }
    if (taxPercent < 0 || taxPercent > 100) {
      return res.status(400).json({ error: 'Tax percent must be between 0 and 100' });
    }

    const rawLineSubtotal = quantity * unitCost;
    const lineDiscount = rawLineSubtotal * (discountPercent / 100);
    const netLineSubtotal = rawLineSubtotal - lineDiscount;
    const lineTax = netLineSubtotal * (taxPercent / 100);
    const lineTotal = netLineSubtotal + lineTax;

    subTotal += rawLineSubtotal;
    discountTotal += lineDiscount;
    taxTotal += lineTax;

    validatedLines.push({
      tenantId,
      productId: line.productId,
      quantity,
      unitCost,
      discountPercent,
      taxPercent,
      taxAmount: parseFloat(lineTax.toFixed(4)),
      lineTotal: parseFloat(lineTotal.toFixed(4)),
    });
  }

  const grandTotal = subTotal - discountTotal + taxTotal;

  try {
    const newBill = await prisma.bill.create({
      data: {
        tenantId,
        billNumber,
        contactId,
        date: date ? new Date(date) : new Date(),
        dueDate: new Date(dueDate),
        status: 'DRAFT',
        subTotal: parseFloat(subTotal.toFixed(4)),
        discountTotal: parseFloat(discountTotal.toFixed(4)),
        taxTotal: parseFloat(taxTotal.toFixed(4)),
        grandTotal: parseFloat(grandTotal.toFixed(4)),
        lines: {
          create: validatedLines,
        },
      },
      include: {
        contact: true,
      },
    });

    res.status(201).json(newBill);
  } catch (error: any) {
    console.error('Bill creation error:', error);
    res.status(500).json({ error: 'Error creating bill' });
  }
});

// POST /api/bills/:id/approve - Approve bill and post ledger entries
router.post('/:id/approve', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { id } = req.params;

  try {
    const updatedBill = await prisma.$transaction(async (tx) => {
      // 1. Post to ledger and adjust stock inside transaction
      await postBillToLedger(tenantId, id, createdByUserId, tx);

      // 2. Query updated bill
      return await tx.bill.findUnique({
        where: { id, tenantId },
        include: {
          contact: true,
          lines: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    res.json({
      success: true,
      message: 'Bill approved, items received, and ledger postings recorded',
      bill: updatedBill,
    });
  } catch (error: any) {
    console.error('Bill approval error:', error);
    res.status(400).json({ error: error.message || 'Error approving bill' });
  }
});

export default router;
