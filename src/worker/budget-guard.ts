import { q } from "./db";
import type { AgentRow } from "./types";

export interface BudgetStatus {
  agent_id: number;
  tokens_run_limit: number;
  tokens_month_limit: number;
  tokens_used_month: number;
  remaining_month: number;
  pct_used: number;
  over: boolean;
  warn_80: boolean;
}

const DEFAULT_RUN = 50_000;
const DEFAULT_MONTH = 500_000;

export async function getBudget(agent: AgentRow): Promise<BudgetStatus> {
  const runLimit = agent.config.budget_tokens_per_run ?? DEFAULT_RUN;
  const monthLimit = agent.config.budget_tokens_per_month ?? DEFAULT_MONTH;
  const r = await q<{ used: number }>(
    `SELECT COALESCE(SUM(tokens_used), 0)::int AS used
       FROM hei_work_agent_actions
      WHERE agent_id = $1
        AND created_at >= date_trunc('month', NOW())`,
    [agent.id],
  );
  const used = r.rows[0]?.used ?? 0;
  const remaining = Math.max(0, monthLimit - used);
  const pct = monthLimit > 0 ? used / monthLimit : 0;
  return {
    agent_id: agent.id,
    tokens_run_limit: runLimit,
    tokens_month_limit: monthLimit,
    tokens_used_month: used,
    remaining_month: remaining,
    pct_used: pct,
    over: used >= monthLimit,
    warn_80: pct >= 0.8,
  };
}
