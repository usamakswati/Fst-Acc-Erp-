import { Router } from 'express';
import { prisma } from '../db';
import { authenticateJWT } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticateJWT);
router.use(requireTenant);

// GET /api/suppliers - Get all suppliers with outstanding balance
router.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;

  try {
    const suppliers = await prisma.contact.findMany({
      where: {
        tenantId,
        type: { in: ['SUPPLIER', 'BOTH'] },
      },
      orderBy: { name: 'asc' },
    });

    const suppliersWithBalance = await Promise.all(
      suppliers.map(async (supplier) => {
        // Sum approved bills
        const billSum = await prisma.bill.aggregate({
          where: {
            tenantId,
            contactId: supplier.id,
            status: { in: ['APPROVED', 'PAID'] },
          },
          _sum: {
            grandTotal: true,
          },
        });

        // Sum payments
        const paymentSum = await prisma.payment.aggregate({
          where: {
            tenantId,
            contactId: supplier.id,
          },
          _sum: {
            amount: true,
          },
        });

        const totalBilled = billSum._sum.grandTotal || 0;
        const totalPaid = paymentSum._sum.amount || 0;
        const balance = totalBilled - totalPaid;

        return {
          ...supplier,
          balance: parseFloat(balance.toFixed(2)),
        };
      })
    );

    res.json(suppliersWithBalance);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Error fetching suppliers' });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { name, email, phone, address, ntn, strn } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  try {
    const supplier = await prisma.contact.create({
      data: {
        tenantId,
        name,
        type: 'SUPPLIER',
        email: email || null,
        phone: phone || null,
        address: address || null,
        ntn: ntn || null,
        strn: strn || null,
      },
    });

    res.status(201).json({ ...supplier, balance: 0 });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Error creating supplier' });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;
  const { name, email, phone, address, ntn, strn, type } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  try {
    const updatedSupplier = await prisma.contact.update({
      where: { id, tenantId },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        ntn: ntn || null,
        strn: strn || null,
        type: type || 'SUPPLIER',
      },
    });

    res.json(updatedSupplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Error updating supplier' });
  }
});

export default router;
