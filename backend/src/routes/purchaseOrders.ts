import { Router } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/purchase-orders - Fetch all POs
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: {
        contact: true,
        lines: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Error fetching purchase orders' });
  }
});

// POST /api/purchase-orders - Create new PO
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { poNumber, contactId, date, lines } = req.body;

  if (!poNumber || !contactId || !lines || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Invalid PO details' });
  }

  // Check unique poNumber
  const existing = await prisma.purchaseOrder.findUnique({
    where: {
      tenantId_poNumber: { tenantId, poNumber }
    }
  });

  if (existing) {
    return res.status(400).json({ error: `PO number ${poNumber} already exists` });
  }

  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  const validatedLines: any[] = [];

  for (const line of lines) {
    const quantity = parseFloat(line.quantity);
    const unitCost = parseFloat(line.unitCost);
    const discountPercent = parseFloat(line.discountPercent) || 0;
    const taxPercent = parseFloat(line.taxPercent) || 0;

    if (quantity <= 0 || unitCost < 0) {
      return res.status(400).json({ error: 'Quantity must be > 0 and unit cost >= 0' });
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
    const newPO = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        contactId,
        date: date ? new Date(date) : new Date(),
        status: 'PENDING',
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

    res.status(201).json(newPO);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Error creating purchase order' });
  }
});

// POST /api/purchase-orders/:id/bill - Convert PO to Bill
router.post('/:id/bill', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id, tenantId },
      include: { lines: true }
    });

    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (po.status === 'BILLED') {
      return res.status(400).json({ error: 'Purchase order has already been billed' });
    }

    // Generate unique Bill number (e.g. BILL-PO-xxxx)
    const billNumber = `BILL-PO-${po.poNumber}`;

    // Verify if billNumber already exists
    const existingBill = await prisma.bill.findUnique({
      where: {
        tenantId_billNumber: { tenantId, billNumber }
      }
    });

    if (existingBill) {
      return res.status(400).json({ error: `Supplier bill ${billNumber} already exists` });
    }

    // Convert lines
    const billLines = po.lines.map(line => ({
      tenantId,
      productId: line.productId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal
    }));

    // Create Draft Bill
    const bill = await prisma.bill.create({
      data: {
        tenantId,
        billNumber,
        contactId: po.contactId,
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days terms
        status: 'DRAFT',
        subTotal: po.subTotal,
        discountTotal: po.discountTotal,
        taxTotal: po.taxTotal,
        grandTotal: po.grandTotal,
        lines: {
          create: billLines
        }
      }
    });

    // Update PO Status
    await prisma.purchaseOrder.update({
      where: { id, tenantId },
      data: { status: 'BILLED' }
    });

    res.json({ success: true, message: 'Purchase order converted to supplier bill successfully', bill });
  } catch (error) {
    console.error('Error converting PO to bill:', error);
    res.status(500).json({ error: 'Error converting PO to bill' });
  }
});

// DELETE /api/purchase-orders/:id - Delete PO
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    await prisma.purchaseOrder.delete({
      where: { id, tenantId }
    });
    res.json({ success: true, message: 'Purchase order deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ error: 'Error deleting purchase order' });
  }
});

export default router;
