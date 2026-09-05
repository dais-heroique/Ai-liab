import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server.js';
import billingRouter from '../src/billing.js';
import {enforceApiUsage} from '../src/api_usage_guard.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const originalUrl=String(req.url||'/');
  const path=originalUrl.split('?')[0];
  if(path.startsWith('/v1/billing')){
    const suffix=originalUrl.slice('/v1/billing'.length)||'/';
    req.url=suffix.startsWith('/')?suffix:`/${suffix}`;
    return billingRouter(req as any,res as any,()=>{
      req.url=originalUrl;
      return app(req as any,res as any);
    });
  }
  if(path==='/api/v1/actions/evaluate') return enforceApiUsage(req as any,res as any,()=>app(req as any,res as any));
  return app(req as any,res as any);
}
