import type { VercelRequest,VercelResponse } from '@vercel/node';
import { getSession } from '../src/auth.js';
import { privateChat } from '../src/private_chat.js';

const cookie=(req:VercelRequest,n:string)=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(n+'='))?.slice(n.length+1);
const sameOrigin=(req:VercelRequest)=>{const origin=String(req.headers.origin||'');if(!origin)return true;const host=String(req.headers.host||'');return origin===`https://${host}`||origin===`http://${host}`;};

export default async function handler(req:VercelRequest,res:VercelResponse){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!sameOrigin(req))return res.status(403).json({error:'origin_not_allowed'});
  try{
    const session=await getSession(cookie(req,'conforva_session'));
    if(!session)return res.status(401).json({error:'authentication_required'});
    const body=req.body||{};
    const message=String(body.message||'').trim();
    const history=Array.isArray(body.history)?body.history.slice(-12).map((x:any)=>({role:x?.role==='assistant'?'assistant':'user',content:String(x?.content||'').slice(0,7000)})):[];
    if(!message)return res.status(400).json({error:'message_required'});
    if(message.length>12000)return res.status(413).json({error:'message_too_large'});
    const result=await privateChat(message,history);
    return res.status(200).json({assistant:'Conforva Intelligence',...result,private:true});
  }catch(e){console.error('Private chat request failed',{error:e instanceof Error?e.message:'unknown'});return res.status(500).json({error:'chat_unavailable'});}
}
