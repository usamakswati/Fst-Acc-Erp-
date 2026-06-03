import { Router } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/customers - Get all customers with outstanding balance
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const customers = await prisma.contact.findMany({
      where: {
        tenantId,
        type: { in: ['CUSTOMER', 'BOTH'] },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate outstanding balance for each customer
    const customersWithBalance = await Promise.all(
      customers.map(async (customer) => {
        // Sum approved invoices
        const invoiceSum = await prisma.invoice.aggregate({
          where: {
            tenantId,
            contactId: customer.id,
            status: { in: ['APPROVED', 'PAID'] },
          },
          _sum: {
            grandTotal: true,
          },
        });

        // Sum receipts
        const receiptSum = await prisma.receipt.aggregate({
          where: {
            tenantId,
            contactId: customer.id,
          },
          _sum: {
            amount: true,
          },
        });

        const totalInvoiced = invoiceSum._sum.grandTotal || 0;
        const totalReceived = receiptSum._sum.amount || 0;
        const balance = totalInvoiced - totalReceived;

        return {
          ...customer,
          balance: parseFloat(balance.toFixed(2)),
        };
      })
    );

    res.json(customersWithBalance);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Error fetching customers' });
  }
});

// POST /api/customers - Create new customer
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { name, email, phone, address, ntn, strn } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  try {
    const customer = await prisma.contact.create({
      data: {
        tenantId,
        name,
        type: 'CUSTOMER',
        email: email || null,
        phone: phone || null,
        address: address || null,
        ntn: ntn || null,
        strn: strn || null,
      },
    });

    res.status(201).json({ ...customer, balance: 0 });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Error creating customer' });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;
  const { name, email, phone, address, ntn, strn, type } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  try {
    const updatedCustomer = await prisma.contact.update({
      where: { id, tenantId },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        ntn: ntn || null,
        strn: strn || null,
        type: type || 'CUSTOMER',
      },
    });

    res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Error updating customer' });
  }
});

export default router;
