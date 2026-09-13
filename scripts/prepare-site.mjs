import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const pages={
 'landing.html':['/','Conforva — Sécurisez les actions de vos agents IA','Conforva vérifie les actions de vos agents IA avant leur exécution et vous donne un historique clair de chaque décision.'],
 'security.html':['/security','Sécurité des agents IA — Conforva','Règles déterministes, vérification indépendante, isolation des organisations et traçabilité des décisions.'],
 'compliance.html':['/compliance','Conformité — Conforva','Informations sur les données, l’infrastructure, la sécurité et les limites de conformité de Conforva.'],
 'pricing.html':['/pricing','Tarifs — Conforva','Tarifs Conforva : Starter, Growth et Pro. 14 jours d’essai gratuit, puis abonnement mensuel via Stripe.'],
 'docs.html':['/docs','Documentation API — Conforva','Documentation HTTP/JSON pour intégrer Conforva à vos applications et contrôler les actions des agents IA.'],
 'faq.html':['/faq','FAQ — Conforva','Questions fréquentes sur la sécurité des agents IA, les données, le chat privé, l’API et les abonnements.'],
 'privacy.html':['/privacy','Politique de confidentialité — Conforva','Données collectées, finalités, sécurité, conservation, cookies et droits concernant Conforva.'],
 'terms.html':['/terms','Conditions d’utilisation — Conforva','Conditions d’utilisation du service Conforva.'],
 'chat.html':['/chat','Chat privé — Conforva','Interface de discussion privée avec Conforva Intelligence et son Security Layer.']
};
for(const [file,[path,title,description]] of Object.entries(pages)){
 const p=join('static',file);let s=readFileSync(p,'utf8');
 s=s.replace(/<title>.*?<\/title>/i,`<title>${title}</title>`).replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi,'').replace(/<meta[^>]+name=["']description["'][^>]*>/gi,'');
 const tags=`<link rel="canonical" href="https://conforva.com${path}"><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="Conforva"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="https://conforva.com${path}"><meta property="og:image" content="https://conforva.com/static/conforva-mark.svg"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="https://conforva.com/static/conforva-mark.svg"><meta name="theme-color" content="#05070a"><style>:focus-visible{outline:2px solid currentColor;outline-offset:3px}html{scroll-behavior:smooth}@media(max-width:700px){body{overflow-x:hidden}button,a{touch-action:manipulation}}</style>`;
 s=s.replace(/<\/head>/i,`${tags}</head>`);
 if(!/<main[^>]*id=["']main-content["']/i.test(s)&&/<main\b/i.test(s))s=s.replace(/<main\b/i,'<main id="main-content"');
 if(!/<a[^>]+href=["']#main-content["']/i.test(s))s=s.replace(/<body([^>]*)>/i,'<body$1><a href="#main-content" style="position:absolute;left:12px;top:12px;z-index:10000;transform:translateY(-200%);padding:8px 12px;background:#0b0d10;color:#fff;border-radius:6px" onfocus="this.style.transform=\'none\'" onblur="this.style.transform=\'translateY(-200%)\'">Aller au contenu</a>');
 if(file!=='landing.html'&&!/cookie-consent\.js/i.test(s)&&file!=='auth.html')s=s.replace(/<\/body>/i,'<script src="/static/cookie-consent.js" defer></script></body>');
 writeFileSync(p,s);
}
console.log(`Prepared ${Object.keys(pages).length} pages with SEO, social metadata, accessibility and consent hooks.`);
