# Conforva

Conforva protects and governs autonomous AI agents.

It sits between an agent and the systems it can affect, evaluating proposed actions before downstream execution and preserving the evidence needed to understand what happened.

## Product model

```text
AI agent
   ↓
Conforva
   ├─ MiniMax M3 — agent reasoning
   ├─ Laguna S 2.1 — security evaluation
   ├─ Deterministic risk + policy enforcement
   ├─ Decision: ALLOW / BLOCK
   └─ Persisted audit evidence
   ↓
Execution eligibility
```

The security model is advisory analysis. Deterministic controls remain authoritative for hard boundaries. Conforva does not make an absolute legal-liability guarantee.

## Current capabilities

- **Tenant accounts** — email/password accounts create an organization and establish an organization-scoped session.
- **Agent profiles** — production-oriented identity, model configuration, autonomous amount limits, blocked actions, hard constraints and permissions.
- **Risk engine** — transparent category-based evaluation across operational risk dimensions.
- **Deterministic rules** — hard policy boundaries are evaluated independently of model output. Legacy human-review policy actions are fail-closed as blocks; there is no human-review queue in the current product.
- **AI security layer** — `poolside/laguna-s-2.1-free` evaluates proposed actions for security threats before an otherwise eligible action is approved.
- **AI agent layer** — `minimax/minimax-m3-free` is used for agent execution through the Vercel AI Gateway.
- **Audit persistence** — evaluations are stored in organization-scoped records in Turso.
- **Live views** — overview, agents, policies, incidents and audit are read from the tenant's database records.
- **API access** — authenticated organizations can create, rotate/revoke and use organization-scoped API keys.
- **Stripe billing** — subscription checkout, customer portal and signed webhook synchronization are supported through Stripe.
- **Public idea validation** — `/v1/idea-vote` remains intentionally unauthenticated and stores vote results in Turso.

## API surface

Public:

- `GET /health`
- `GET /v1/auth/me`
- `POST /v1/auth/signup`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/idea-vote`
- `POST /v1/idea-vote`
- `POST /v1/billing/webhook` — Stripe-signed webhook endpoint

Authenticated account:

- `GET /v1/billing`
- `POST /v1/billing/checkout`
- `POST /v1/billing/portal`
- `GET /v1/api-keys`
- `POST /v1/api-keys`
- `DELETE /v1/api-keys/:id`
- `GET /v1/usage`

Authenticated product API:

- `GET /v1/overview`
- `GET /v1/agents`
- `POST /v1/agents`
- `PATCH /v1/agents/:agent_id`
- `POST /v1/actions/evaluate`
- `POST /v1/agents/:agent_id/run`
- `POST /v1/ai/analyze`
- `GET /v1/ai/models`
- `GET /v1/policies`
- `GET /v1/audit`
- `GET /v1/incidents`
- `GET /v1/escalations`

Developer API:

- `POST /api/v1/actions/evaluate` — authenticated with `Authorization: Bearer <API_KEY>` and isolated to the organization owning the key.

## Database

Turso/libSQL is the persistence layer. The application reads credentials only from `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

Billing state is persisted in `billing_accounts`; usage is persisted in `usage_events`; API keys are stored as hashes and are never returned after their initial creation.

Secrets are not stored in the repository.

## Stripe configuration

Configure these server-side environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_TEAM`
- `STRIPE_PRICE_ENTERPRISE`

Create the matching recurring prices in Stripe and set their Price IDs in Vercel. Configure Stripe to send subscription and checkout events to `/v1/billing/webhook`.

## Local development

```bash
npm install
npm run dev
```

The server listens on port `3000`.

For TypeScript validation:

```bash
npm run build
```

## Architecture

- `server.ts` — HTTP entrypoint, authentication boundary, billing boundary and product request flow.
- `src/risk_engine.ts` — deterministic risk scoring.
- `src/policy_engine.ts` — deterministic enforcement.
- `src/ai_gateway.ts` — Vercel AI Gateway model calls.
- `src/db.ts` — Turso persistence and tenant-scoped records.
- `src/stripe.ts` — Stripe Checkout, customer portal and webhook signature verification.
- `src/control_plane_db.ts` — live overview, policy, incident and audit queries.
- `src/auth.ts` — account and session persistence.
- `static/dashboard.html` — product console shell.
- `static/dashboard-core.js` — live console behavior and backend integration.

## Production boundaries

This repository is a product-development codebase and still requires deployment hardening before real customer workloads. Authentication, authorization, tenant isolation and secret handling are implemented at the application layer, while durable event delivery, infrastructure hardening, rate limiting, operational monitoring and comprehensive integration testing remain production concerns.

Risk scores are interpretable control signals, not actuarial or legal determinations. Conforva does not claim insurance coverage or an absolute legal guarantee without an actual contractual arrangement.
