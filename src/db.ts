import { createClient, type Client } from '@libsql/client';
import type { AgentConfig } from './types.js';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const dbEnabled = Boolean(url && authToken);
const client: Client | null = dbEnabled ? createClient({ url: url!, authToken: authToken! }) : null;

export async function initDb() {
  if (!client) return;
  await client.batch([
    `CREATE TABLE IF NOT EXISTS agents (agent_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, organization_id TEXT NOT NULL, agent_id TEXT NOT NULL, action_type TEXT NOT NULL, decision TEXT NOT NULL, risk_score REAL, data TEXT NOT NULL, created_at TEXT NOT NULL)`,
  ], 'write');
}

export async function loadAgents(organizationId: string): Promise<Record<string, AgentConfig>> {
  if (!client) return {};
  const result = await client.execute({ sql: 'SELECT agent_id, data FROM agents WHERE organization_id = ?', args: [organizationId] });
  return Object.fromEntries(result.rows.map(row => [String(row.agent_id), JSON.parse(String(row.data)) as AgentConfig]));
}

export async function saveAgent(agentId: string, agent: AgentConfig) {
  if (!client) return;
  await client.execute({ sql: `INSERT INTO agents (agent_id, organization_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(agent_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`, args: [agentId, agent.organization_id || 'org_acme_global', JSON.stringify(agent), agent.created_at || new Date().toISOString(), agent.updated_at || new Date().toISOString()] });
}

export async function saveDecision(organizationId: string, agentId: string, actionType: string, decision: string, riskScore: number, data: unknown) {
  if (!client) return;
  await client.execute({ sql: 'INSERT INTO decisions (organization_id, agent_id, action_type, decision, risk_score, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [organizationId, agentId, actionType, decision, riskScore, JSON.stringify(data), new Date().toISOString()] });
}

export async function getDecisionCount(organizationId: string) {
  if (!client) return 0;
  const result = await client.execute({ sql: 'SELECT COUNT(*) AS count FROM decisions WHERE organization_id = ?', args: [organizationId] });
  return Number(result.rows[0]?.count || 0);
}
