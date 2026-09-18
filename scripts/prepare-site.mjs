import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const pages={
 'landing.html':['/','Sécurité et gouvernance des agents IA | Conforva','Conforva vérifie les actions de vos agents IA avant leur exécution et vous donne un historique clair de chaque décision.'],
 'security.html':['/security','Sécurité des agents IA — Conforva','Règles déterministes, vérification indépendante, isolation des organisations et traçabilité des décisions.'],
 'compliance.html':['/compliance','Conformité — Conforva','Informations sur les données, l’infrastructure, la sécurité et les limites de conformité de Conforva.'],
 'pricing.html':['/pricing','Tarifs — Conforva','Tarifs Conforva : Starter, Growth et Pro. 14 jours d’essai gratuit, puis abonnement mensuel via Stripe.'],
 'docs.html':['/docs','Documentation API — Conforva','Documentation HTTP/JSON pour intégrer Conforva à vos applications et contrôler les actions des agents IA.'],
 'faq.html':['/faq','FAQ — Conforva','Questions fréquentes sur la sécurité des agents IA, les données, le chat privé, l’API et les abonnements.'],
 'privacy.html':['/privacy','Politique de confidentialité — Conforva','Données collectées, finalités, sécurité, conservation, cookies et droits concernant Conforva.'],
 'terms.html':['/terms','Conditions d’utilisation — Conforva','Conditions d’utilisation du service Conforva.'],
 'chat.html':['/chat','Chat privé — Conforva','Interface de discussion privée avec Conforva Intelligence et son Security Layer.'],
 'ai-agent-security.html':['/ai-agent-security','Sécurité des agents IA | Conforva','Contrôlez les actions de vos agents IA avant leur exécution avec des règles, des limites et un audit exploitable.'],
 'ai-agent-governance.html':['/ai-agent-governance','Gouvernance des agents IA | Conforva','Cadrez les capacités, limites, politiques et décisions de vos agents IA autonomes.'],
 'ai-agent-guardrails.html':['/ai-agent-guardrails','Garde-fous pour agents IA | Conforva','Appliquez des garde-fous runtime au moment où vos agents IA s’apprêtent à agir.'],
 'ai-agent-action-governance.html':['/ai-agent-action-governance','Gouvernance des actions des agents IA | Conforva','Gouvernez les actions sensibles de vos agents IA avec des politiques, seuils et validations explicites.'],
 'ai-agent-authorization.html':['/ai-agent-authorization','Autorisation des agents IA | Conforva','Définissez le périmètre, les capacités, les ressources et les limites autorisées pour chaque agent IA.'],
 'ai-agent-observability.html':['/ai-agent-observability','Observabilité des agents IA | Conforva','Comprenez les actions, décisions, incidents et événements d’audit de vos agents IA.'],
 'ai-agent-risk-management.html':['/ai-agent-risk-management','Gestion des risques des agents IA | Conforva','Réduisez le rayon d’impact des agents autonomes grâce à des limites et contrôles opérationnels.'],
 'ai-agent-security-for-ecommerce.html':['/ai-agent-security-for-ecommerce','Sécurité des agents IA pour l’e-commerce | Conforva','Sécurisez remboursements, commandes, données clients et APIs utilisées par vos agents IA.'],
 'ai-agent-security-for-finance.html':['/ai-agent-security-for-finance','Sécurité des agents IA pour la finance | Conforva','Ajoutez des limites et validations aux paiements, transferts et opérations financières des agents IA.'],
 'ai-agent-security-for-customer-service.html':['/ai-agent-security-for-customer-service','Sécurité des agents IA pour le service client | Conforva','Encadrez les lectures, écritures, communications et escalades de vos agents de support.'],
 'blog-what-are-ai-agents.html':['/blog/what-are-ai-agents','Que sont les agents IA ? | Conforva','Comprendre les agents IA, leurs outils, leur autonomie et les risques liés à leurs actions.'],
 'blog-what-are-ai-agent-guardrails.html':['/blog/what-are-ai-agent-guardrails','Que sont les garde-fous pour agents IA ? | Conforva','Comprendre les garde-fous runtime et pourquoi ils contrôlent les actions avant leur exécution.'],
 'blog-ai-agent-security-checklist.html':['/blog/ai-agent-security-checklist','Checklist de sécurité des agents IA | Conforva','Une checklist pratique pour sécuriser identité, privilèges, limites et audit des agents IA autonomes.'],
 'blog-ai-agent-governance-framework.html':['/blog/ai-agent-governance-framework','Cadre de gouvernance des agents IA | Conforva','Construire un cadre de gouvernance reliant rôles, capacités, politiques, décisions et preuves.'],
 'blog-ai-agent-vs-chatbot.html':['/blog/ai-agent-vs-chatbot','Agent IA vs chatbot : quelle différence ? | Conforva','Comprendre pourquoi le contrôle change quand une IA peut utiliser des outils et déclencher des actions.']
};
for(const [file,[path,title,description]] of Object.entries(pages)){
 const p=join('static',file);let s=readFileSync(p,'utf8');
 s=s.replace(/<title>.*?<\/title>/i,`<title>${title}</title>`).replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi,'').replace(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)["'][^>]*>/gi,'').replace(/<meta[^>]+name=["']description["'][^>]*>/gi,'').replace(/<script type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi,'');
 const structured=JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://conforva.com/#organization","name":"Conforva","url":"https://conforva.com/"},{"@type":"WebSite","@id":"https://conforva.com/#website","url":"https://conforva.com/","name":"Conforva","publisher":{"@id":"https://conforva.com/#organization"}},{"@type":"WebPage","@id":`https://conforva.com${path}#webpage`,"url":`https://conforva.com${path}`,"name":title,"description":description,"isPartOf":{"@id":"https://conforva.com/#website"},"publisher":{"@id":"https://conforva.com/#organization"}}]});
 const tags=`<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/favicon.ico"><link rel="canonical" href="https://conforva.com${path}"><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="Conforva"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="https://conforva.com${path}"><meta property="og:image" content="https://conforva.com/static/conforva-mark.svg"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="https://conforva.com/static/conforva-mark.svg"><meta name="theme-color" content="#05070a"><script type="application/ld+json">${structured}</script><style>:focus-visible{outline:2px solid currentColor;outline-offset:3px}html{scroll-behavior:smooth}@media(max-width:700px){body{overflow-x:hidden}button,a{touch-action:manipulation}}</style>`;
 s=s.replace(/<\/head>/i,`${tags}</head>`);
 if(!/<main[^>]*id=["']main-content["']/i.test(s)&&/<main\b/i.test(s))s=s.replace(/<main\b/i,'<main id="main-content"');
 if(!/<a[^>]+href=["']#main-content["']/i.test(s))s=s.replace(/<body([^>]*)>/i,'<body$1><a href="#main-content" style="position:absolute;left:12px;top:12px;z-index:10000;transform:translateY(-200%);padding:8px 12px;background:#0b0d10;color:#fff;border-radius:6px" onfocus="this.style.transform=\'none\'" onblur="this.style.transform=\'translateY(-200%)\'">Aller au contenu</a>');
 if(file!=='landing.html'&&!/cookie-consent\.js/i.test(s)&&file!=='auth.html')s=s.replace(/<\/body>/i,'<script src="/static/cookie-consent.js" defer></script></body>');
 writeFileSync(p,s);
}
console.log(`Prepared ${Object.keys(pages).length} pages with SEO, social metadata, accessibility and consent hooks.`);
