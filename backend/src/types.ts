import { Request } from 'express';

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  tenantId?: string;
}
