import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server.js';
import billingRouter from '../src/billing.js';
import {enforceApiCredit} from '../src/api_credit_guard.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const path=String(req.url||'').split('?')[0];
  if(path.startsWith('/v1/billing')) return billingRouter(req as any,res as any,()=>app(req as any,res as any));
  if(path==='/api/v1/actions/evaluate') return enforceApiCredit(req as any,res as any,()=>app(req as any,res as any));
  return app(req as any,res as any);
}