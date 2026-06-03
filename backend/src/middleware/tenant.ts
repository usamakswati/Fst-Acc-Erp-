import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../db';

export async function requireTenant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.tenantId) {
    return res.status(400).json({ error: 'Tenant context is missing from request' });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error validating tenant context' });
  }
}
