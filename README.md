# Conforva

Conforva is a control plane for autonomous AI agents.

It sits between an agent and the systems it can affect, evaluating proposed actions before downstream execution and preserving the evidence needed to understand what happened.

## Product model

```text
AI agent
   ↓
Conforva
   ├─ Risk evaluation
   ├─ Deterministic policy enforcement
   ├─ Verification / model routing
   ├─ Decision: ALLOW / HUMAN REVIEW / BLOCK
   └─ Cryptographic audit evidence
   ↓
Downstream execution
```

The product is deliberately positioned around **control, observability and evidence**. It does not make an absolute legal-liability guarantee.

## Current capabilities

- **Agent control profiles** — production-oriented identity, model/fallback configuration, autonomous amount limits, blocked actions, hard constraints and human operator assignment.
- **Risk engine** — transparent category-based evaluation across finance, legal, privacy, cyber, autonomy and physical impact.
- **Deterministic policy engine** — hard policy boundaries are evaluated independently of model output; policy decisions can allow, require human review or block.
- **Provider-neutral model routing** — model/provider selection and verification metadata are separated from policy enforcement.
- **Human oversight** — actions above configured thresholds can be held for operator review rather than executed automatically.
- **AI Passport** — an inspectable agent contract with configuration, recent decisions, statistics and a cryptographic seal.
- **Audit integrity** — decision records include chained proof material and an integrity verification endpoint.
- **Idempotent evaluation** — action requests can carry an idempotency key so retries do not create duplicate decisions.
- **Incidents and forensics** — the product model includes incident timelines connecting detection, policy enforcement, human intervention and resolution.
- **Developer surface** — a small public API contract is defined in `src/api_contract.ts` for evaluation, execution, agents, passports, verification, audit integrity and health.
- **Enterprise console** — the dashboard provides fleet overview, agents, policies, activity, risk, reviews, incidents, audit, sandbox, passports and platform/developer surfaces.

## API surface

The current server exposes:

- `POST /v1/actions/evaluate`
- `POST /v1/actions/execute`
- `POST /v1/agents/:agent_id/action`
- `GET /v1/agents`
- `POST /v1/agents`
- `GET /v1/agents/:agent_id/passport`
- `POST /v1/agents/:agent_id/passport/verify`
- `GET /v1/audit/integrity`
- `GET /health`

The canonical public contract is kept in `src/api_contract.ts`.

## Local development

```bash
npm install
npm run dev
```

The server listens on port `3000`.

For a TypeScript validation build:

```bash
npm run build
```

## Demo agents

The current configuration includes five representative profiles:

- Customer support / FAQ
- Enterprise customer operations
- Treasury and disbursement
- CNC industrial control
- Cloud infrastructure / SRE

Their configuration is stored in `config/agents.json`.

## Architecture

- `server.ts` — HTTP entrypoint and control-plane request flow.
- `src/risk_engine.ts` — risk scoring.
- `src/policy_engine.ts` — deterministic enforcement.
- `src/model_router.ts` / `src/ai_provider_router.ts` — provider/model selection and verification planning.
- `src/audit.ts` — audit records, escalations, policies, incidents, API keys and cryptographic evidence.
- `src/api_contract.ts` — public API contract and decision normalization.
- `src/types.ts` — shared domain types.
- `static/dashboard.html` — product console shell.
- `static/dashboard-core.js` — live console behavior and backend integration.
- `static/enterprise-ux.js` — command palette, accessibility and interaction polish.
- `static/conforva-brand.js` — product identity layer.
- `static/conforva-premium.js` — premium control-plane UX layer.

## Important production boundaries

This repository is still a product-development codebase, not a finished multi-tenant production deployment. In particular, persistence, authentication, authorization, tenant isolation, secret handling, durable event delivery and deployment hardening should be treated as production work before handling real customer workloads.

The risk score is an interpretable control signal, not an actuarial or legal determination. Insurance-related configuration should not be presented as coverage supplied by Conforva without an actual contractual arrangement.
