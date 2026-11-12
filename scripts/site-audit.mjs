import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';

const root='static';
const vercel=JSON.parse(readFileSync('vercel.json','utf8'));
const html=readdirSync(root).filter(f=>f.endsWith('.html'));

// Every public path declared in vercel.json (routes + redirects).
const knownPaths=new Set([
  ...vercel.routes.map(r=>r.src).filter(src=>!/[()*\\]/.test(src)),
  ...(vercel.redirects||[]).map(r=>r.source),
]);
const isKnownPath=p=>knownPaths.has(p)||p.startsWith('/v1/')||p.startsWith('/api/v1/');

let errors=0;
const fail=msg=>{console.error(msg);errors++;};

for(const file of html){
  const s=readFileSync(join(root,file),'utf8');
  if(!/<meta[^>]+name=["']viewport["']/i.test(s))fail(`${file}: missing viewport meta`);
  for(const m of s.matchAll(/(?:href|src)=["'](\/static\/[^"'#?]+)[^"']*["']/gi)){
    if(!existsSync(join(root,m[1].replace('/static/',''))))fail(`${file}: missing local asset ${m[1]}`);
  }
  for(const m of s.matchAll(/href=["'](\/(?!static\/)[^"'#?]*)(?:[?#][^"']*)?["']/gi)){
    if(!isKnownPath(m[1]))fail(`${file}: link to unknown route ${m[1]}`);
  }
  for(const m of s.matchAll(/<img\b[^>]*>/gi)){
    if(!/\balt=["'][^"']*["']/i.test(m[0]))fail(`${file}: image without alt`);
  }
  for(const m of s.matchAll(/<form\b[\s\S]*?<\/form>/gi)){
    if(!/<(input|textarea|select)\b/i.test(m[0]))fail(`${file}: form has no field`);
    if(!/<label\b|aria-label=|placeholder=/i.test(m[0]))fail(`${file}: form field has no label`);
  }
}
for(const m of readFileSync(join(root,'sitemap.xml'),'utf8').matchAll(/<loc>https:\/\/conforva\.com(\/[^<]*)<\/loc>/g)){
  if(!isKnownPath(m[1]))fail(`sitemap.xml: unknown route ${m[1]}`);
}
if(!JSON.stringify(vercel.headers||[]).includes('Cache-Control'))fail('vercel.json: static caching not configured');

if(errors){console.error(`Site audit failed with ${errors} issue(s).`);process.exit(1);}
console.log(`Site audit OK: ${html.length} HTML pages checked (assets, routes, forms, meta, sitemap).`);
