import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';
import { postInvoiceToLedger } from '../services/ledger';
import { submitInvoiceToFbr } from '../services/fbr';
import { reverseStockOutflow } from '../services/inventory';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/invoices - Fetch all invoices
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { isPos } = req.query;

  try {
    const invoices = await prisma.invoice.findMany({
      where: { 
        tenantId,
        isPos: isPos !== undefined ? isPos === 'true' : undefined,
      },
      include: {
        contact: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching invoices' });
  }
});

// GET /api/invoices/contacts - Helper to get all contacts (for dropdown)
router.get('/contacts', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  try {
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching contacts' });
  }
});

// POST /api/invoices/contacts - Create a new contact (Customer/Supplier)
router.post('/contacts', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { name, type, email, phone, address, ntn, strn } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  try {
    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name,
        type, // CUSTOMER, SUPPLIER, BOTH
        email: email || null,
        phone: phone || null,
        address: address || null,
        ntn: ntn || null,
        strn: strn || null,
      },
    });
    res.status(201).json(contact);
  } catch (error) {
    console.error('Contact creation error:', error);
    res.status(500).json({ error: 'Error creating contact' });
  }
});

// GET /api/invoices/:id - Fetch single invoice with details
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    const invoice = await prisma.invoice.findUnique({
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

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching invoice details' });
  }
});

// POST /api/invoices - Create a new invoice
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { invoiceNumber, contactId, date, dueDate, lines, isPos, paymentAccountId } = req.body;

  if (!invoiceNumber || !contactId || !dueDate || !lines || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Invalid invoice request details' });
  }

  // Double check invoice number uniqueness for tenant
  const existing = await prisma.invoice.findUnique({
    where: {
      tenantId_invoiceNumber: { tenantId, invoiceNumber },
    },
  });

  if (existing) {
    return res.status(400).json({ error: `Invoice number ${invoiceNumber} already exists` });
  }

  // Calculate totals and validate lines
  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  const validatedLines: any[] = [];

  for (const line of lines) {
    const quantity = parseFloat(line.quantity);
    const unitPrice = parseFloat(line.unitPrice);
    const discountPercent = parseFloat(line.discountPercent) || 0.0;
    const taxPercent = parseFloat(line.taxPercent) || 0.0;

    if (quantity <= 0 || unitPrice < 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero and Price cannot be negative' });
    }
    if (discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({ error: 'Discount percent must be between 0 and 100' });
    }
    if (taxPercent < 0 || taxPercent > 100) {
      return res.status(400).json({ error: 'Tax percent must be between 0 and 100' });
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
      tenantId,
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
    const result = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          contactId,
          date: date ? new Date(date) : new Date(),
          dueDate: new Date(dueDate),
          status: isPos ? 'APPROVED' : 'DRAFT',
          isPos: isPos || false,
          paymentAccountId: paymentAccountId || null,
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

      // If POS, post to ledger immediately
      if (isPos) {
        await postInvoiceToLedger(tenantId, newInvoice.id, createdByUserId, tx);
      }

      return newInvoice;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Invoice creation error:', error);
    res.status(500).json({ error: error.message || 'Error creating invoice' });
  }
});

// POST /api/invoices/:id/approve - Approve invoice and post ledger entries
router.post('/:id/approve', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { id } = req.params;

  try {
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Post to ledger and adjust stock inside transaction
      await postInvoiceToLedger(tenantId, id, createdByUserId, tx);

      // 2. Query updated invoice
      return await tx.invoice.findUnique({
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
      message: 'Invoice approved and ledger postings recorded',
      invoice: updatedInvoice,
    });
  } catch (error: any) {
    console.error('Invoice approval error:', error);
    res.status(400).json({ error: error.message || 'Error approving invoice' });
  }
});

// POST /api/invoices/:id/fbr-submit - Submit e-Invoice to Pakistan FBR Portal
router.post('/:id/fbr-submit', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    const result = await submitInvoiceToFbr(tenantId, id);
    res.json(result);
  } catch (error: any) {
    console.error('FBR e-Invoice submission error:', error);
    res.status(400).json({ error: error.message || 'Error submitting to FBR' });
  }
});

// Helper to reverse general ledger entries and stock outflows for an invoice
async function reverseLedgerAndStockForInvoice(tenantId: string, invoiceId: string, tx: any) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId, tenantId },
  });
  if (!invoice) return;

  // 1. Delete associated JournalEntry by reference (cascades delete JournalLine)
  await tx.journalEntry.deleteMany({
    where: {
      tenantId,
      reference: invoice.invoiceNumber,
    },
  });

  // 2. Fetch all StockTransaction outflows for this invoice
  const stockTxns = await tx.stockTransaction.findMany({
    where: {
      tenantId,
      referenceType: 'INVOICE',
      referenceId: invoiceId,
    },
  });

  // 3. Reverse outflows in inventory FIFO/Average queues
  for (const txn of stockTxns) {
    if (txn.quantity < 0) {
      const qtyToRestore = Math.abs(txn.quantity);
      await reverseStockOutflow(tenantId, txn.productId, qtyToRestore, txn.warehouse, tx);
    }
  }

  // 4. Delete the StockTransaction records
  await tx.stockTransaction.deleteMany({
    where: {
      tenantId,
      referenceType: 'INVOICE',
      referenceId: invoiceId,
    },
  });
}

// PUT /api/invoices/:id - Update an invoice
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const createdByUserId = req.user!.id;
  const { id } = req.params;
  const { invoiceNumber, contactId, date, dueDate, lines, isPos, paymentAccountId } = req.body;

  if (!invoiceNumber || !contactId || !dueDate || !lines || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Invalid invoice request details' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.invoice.findUnique({
        where: { id, tenantId },
      });

      if (!existingInvoice) {
        throw new Error('Invoice not found');
      }

      const numberConflict = await tx.invoice.findFirst({
        where: {
          tenantId,
          invoiceNumber,
          id: { not: id },
        },
      });

      if (numberConflict) {
        throw new Error(`Invoice number ${invoiceNumber} already exists`);
      }

      const originalStatus = existingInvoice.status;

      // Reverse postings if originally APPROVED
      if (originalStatus === 'APPROVED' || originalStatus === 'PAID') {
        await tx.invoice.update({
          where: { id },
          data: { status: 'DRAFT' },
        });

        await reverseLedgerAndStockForInvoice(tenantId, id, tx);
      }

      // Calculate totals
      let subTotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      const validatedLines: any[] = [];

      for (const line of lines) {
        const quantity = parseFloat(line.quantity);
        const unitPrice = parseFloat(line.unitPrice);
        const discountPercent = parseFloat(line.discountPercent) || 0.0;
        const taxPercent = parseFloat(line.taxPercent) || 0.0;

        if (quantity <= 0 || unitPrice < 0) {
          throw new Error('Quantity must be greater than zero and Price cannot be negative');
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
          tenantId,
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

      // Delete old invoice lines
      await tx.invoiceLine.deleteMany({
        where: { invoiceId: id, tenantId },
      });

      // Update invoice details & lines
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber,
          contactId,
          date: date ? new Date(date) : new Date(),
          dueDate: new Date(dueDate),
          isPos: isPos || false,
          paymentAccountId: paymentAccountId || null,
          subTotal: parseFloat(subTotal.toFixed(4)),
          discountTotal: parseFloat(discountTotal.toFixed(4)),
          taxTotal: parseFloat(taxTotal.toFixed(4)),
          grandTotal: parseFloat(grandTotal.toFixed(4)),
          status: 'DRAFT',
          lines: {
            create: validatedLines,
          },
        },
        include: {
          contact: true,
          lines: {
            include: { product: true }
          }
        },
      });

      // Re-post to ledger if originally APPROVED
      if (originalStatus === 'APPROVED' || originalStatus === 'PAID') {
        await postInvoiceToLedger(tenantId, id, createdByUserId, tx);
      }

      return updatedInvoice;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Invoice update error:', error);
    res.status(400).json({ error: error.message || 'Error updating invoice' });
  }
});

// DELETE /api/invoices/:id - Delete an invoice
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id, tenantId },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Reverse postings if APPROVED
      if (invoice.status === 'APPROVED' || invoice.status === 'PAID') {
        await tx.invoice.update({
          where: { id },
          data: { status: 'DRAFT' },
        });

        await reverseLedgerAndStockForInvoice(tenantId, id, tx);
      }

      // Delete invoice (cascades to lines)
      await tx.invoice.delete({
        where: { id, tenantId },
      });
    });

    res.json({ success: true, message: 'Invoice successfully deleted' });
  } catch (error: any) {
    console.error('Invoice deletion error:', error);
    res.status(400).json({ error: error.message || 'Error deleting invoice' });
  }
});

export default router;
