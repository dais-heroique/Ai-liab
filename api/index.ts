import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server.js';
import billingRouter from '../src/billing.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (String(req.url||'').split('?')[0].startsWith('/v1/billing')) return billingRouter(req as any, res as any, ()=>app(req as any,res as any));
  return app(req as any, res as any);
}
