# AI Liability Gateway — MVP

Prototype technique de l'infrastructure "AI Liability Infrastructure" :
au lieu de brancher une entreprise directement sur un LLM, on fait transiter
chaque action proposée par un agent IA à travers un gateway qui la note, la
compare au contrat de l'agent, journalise la décision, et route vers un
humain quand c'est nécessaire.

```
Entreprise → Gateway → Risk Engine → Policy Engine → Model Router → LLM
                              ↓              ↓
                          Audit Log   Escalade humaine
```

## Ce que fait ce MVP

- **Risk Engine** (`app/risk_engine.py`) — note chaque action sur 6 catégories
  (finance, légal, privacy, cyber, autonomie, impact physique) à partir d'un
  catalogue de types d'action, avec un score qui monte avec le montant pour
  les actions financières.
- **Policy Engine** (`app/policy_engine.py`) — couche déterministe : types
  d'action interdits et **contraintes physiques câblées en dur** (ex. RPM
  max d'une machine) bloquent toujours, indépendamment du score de risque.
  Au-delà d'un seuil de risque ou de montant → escalade humaine plutôt que
  blocage.
- **Model Router** (`app/model_router.py`) — choisit et appelle le modèle
  défini dans le contrat de l'agent. Claude est branché en vrai (avec ta clé
  API) ; les autres fournisseurs sont mockés proprement pour montrer la
  logique de routing/repli sans dépendre de leurs clés.
- **Audit** (`app/audit.py`) — SQLite local (`gateway.db`), une ligne par
  décision, plus une file d'escalade avec résolution par un opérateur.
- **AI Passport** (`GET /v1/agents/{id}/passport`) — le contrat lisible d'un
  agent : modèle, seuils, assurance, opérateur assigné, stats vécues.
- **Dashboard** (`/`) — console pour soumettre une action de test, traiter
  la file d'escalade, et consulter le journal d'audit.

Trois agents de démo dans `config/agents.json`, calqués sur les trois
niveaux du document stratégique :
- `acme-faq-bot` (AI SAFE, Niveau 0 — informationnel)
- `acme-customer-agent` (AI GUARANTEE, Niveau 1 — actions logicielles / SAV)
- `acme-cnc-controller` (AI CRITICAL, Niveau 2 — contrôle machine, avec
  limite RPM câblée en dur pour démontrer la couche de sécurité
  déterministe)

## Lancer en local

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Optionnel : pour que le Model Router appelle vraiment Claude
export ANTHROPIC_API_KEY="sk-ant-..."

uvicorn app.main:app --reload --port 8000
```

Ouvre `http://127.0.0.1:8000` pour le dashboard.

Pour peupler rapidement le journal et la file d'escalade avec des exemples :

```bash
chmod +x demo_seed.sh
./demo_seed.sh
```

## Limites connues de ce MVP (à traiter avant tout vrai client)

- Un seul process, une seule base SQLite locale — pas de multi-tenant, pas
  d'auth sur les endpoints (`/v1/agents/{id}/action` accepte n'importe qui).
- Le Risk Engine est un barème de règles, transparent mais grossier — à
  affiner avec de vraies données d'incidents avant de vendre le "Risk
  Score" comme argument commercial.
- Le Model Router ne gère réellement que Claude ; OpenAI/Gemini/Mistral/
  local sont mockés — brancher un client réel par fournisseur est direct
  (`call_model` dans `app/model_router.py`).
- Pas de volet assurance/contrat réel : `insurance_coverage_eur` est un
  champ statique de config, pas un calcul actuariel. C'est précisément le
  point à cadrer avec des juristes/assureurs avant d'en faire un vrai
  argument de vente (cf. section 6 du document stratégique).
- Pas de webhook de retour vers l'entreprise cliente quand une escalade est
  résolue — à ajouter dès qu'il y a un vrai système en aval à notifier.

## Prochaines étapes suggérées

1. Auth par entreprise (clé API par tenant, isolation des données).
2. Historiser le Risk Score dans le temps par agent (courbe, pas juste une
   moyenne) pour nourrir la boucle "moins d'incidents → moins d'assurance →
   plus de marge" décrite dans la stratégie.
3. Endpoint de génération du contrat "AI Passport" en PDF signable.
4. Vrai routing multi-fournisseur (au moins OpenAI en plus de Claude) pour
   démontrer le repli automatique en cas de panne fournisseur.
5. Rejouer les 3 agents de démo comme base d'un premier pitch client sur le
   segment "agents SAV" (Niveau 1) — c'est le point d'entrée le moins
   risqué recommandé dans le document stratégique (section 18).
