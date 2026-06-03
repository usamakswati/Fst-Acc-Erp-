import { Router } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/orders - Get all sales orders
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const orders = await prisma.salesOrder.findMany({
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
    console.error('Error fetching sales orders:', error);
    res.status(500).json({ error: 'Error fetching sales orders' });
  }
});

// POST /api/orders - Create a new sales order
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { orderNumber, contactId, date, lines } = req.body;

  if (!orderNumber || !contactId || !lines || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Invalid sales order details' });
  }

  // Check unique orderNumber
  const existing = await prisma.salesOrder.findUnique({
    where: {
      tenantId_orderNumber: { tenantId, orderNumber }
    }
  });

  if (existing) {
    return res.status(400).json({ error: `Order number ${orderNumber} already exists` });
  }

  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  const validatedLines: any[] = [];

  for (const line of lines) {
    const quantity = parseFloat(line.quantity);
    const unitPrice = parseFloat(line.unitPrice);
    const discountPercent = parseFloat(line.discountPercent) || 0;
    const taxPercent = parseFloat(line.taxPercent) || 0;

    if (quantity <= 0 || unitPrice < 0) {
      return res.status(400).json({ error: 'Quantity must be > 0 and price >= 0' });
    }

    const rawLineSubtotal = quantity * unitPrice;
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
      unitPrice,
      discountPercent,
      taxPercent,
      taxAmount: parseFloat(lineTax.toFixed(4)),
      lineTotal: parseFloat(lineTotal.toFixed(4)),
    });
  }

  const grandTotal = subTotal - discountTotal + taxTotal;

  try {
    const newOrder = await prisma.salesOrder.create({
      data: {
        tenantId,
        orderNumber,
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

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating sales order:', error);
    res.status(500).json({ error: 'Error creating sales order' });
  }
});

// POST /api/orders/:id/invoice - Convert Sales Order to Invoice
router.post('/:id/invoice', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id, tenantId },
      include: { lines: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (order.status === 'INVOICED') {
      return res.status(400).json({ error: 'Sales order has already been invoiced' });
    }

    // Generate unique invoice number (e.g., INV-SO-xxxx)
    const invoiceNumber = `INV-SO-${order.orderNumber}`;

    // Validate if invoice number already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: {
        tenantId_invoiceNumber: { tenantId, invoiceNumber }
      }
    });

    if (existingInvoice) {
      return res.status(400).json({ error: `Invoice number ${invoiceNumber} already exists` });
    }

    // Convert order lines to invoice lines
    const invoiceLines = order.lines.map(line => ({
      tenantId,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal
    }));

    // Create Draft Invoice
    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        contactId: order.contactId,
        date: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days payment terms
        status: 'DRAFT',
        subTotal: order.subTotal,
        discountTotal: order.discountTotal,
        taxTotal: order.taxTotal,
        grandTotal: order.grandTotal,
        lines: {
          create: invoiceLines
        }
      }
    });

    // Update Sales Order status
    await prisma.salesOrder.update({
      where: { id, tenantId },
      data: { status: 'INVOICED' }
    });

    res.json({ success: true, message: 'Sales order converted to invoice successfully', invoice });
  } catch (error) {
    console.error('Error converting sales order to invoice:', error);
    res.status(500).json({ error: 'Error converting sales order to invoice' });
  }
});

// DELETE /api/orders/:id - Delete sales order
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    await prisma.salesOrder.delete({
      where: { id, tenantId }
    });
    res.json({ success: true, message: 'Sales order deleted successfully' });
  } catch (error) {
    console.error('Error deleting sales order:', error);
    res.status(500).json({ error: 'Error deleting sales order' });
  }
});

export default router;
