import { notFound } from "next/navigation";
import Link from "next/link";

import { query } from "@/lib/db";
import { listMissions } from "@/lib/queries/missions";
import type { Member } from "@/lib/types";

import AgentEditor from "./AgentEditor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ActionRow {
  id: number;
  task_id: number | null;
  task_title: string | null;
  action_type: string;
  status: string;
  tokens_used: number;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export default async function AgentPage({ params }: PageProps) {
  const { id } = await params;
  const agentId = Number(id);
  if (!Number.isFinite(agentId)) notFound();

  const agentR = await query<Member>(
    `SELECT * FROM hei_work_members WHERE id=$1 AND type='agent'`,
    [agentId],
  );
  const agent = agentR.rows[0];
  if (!agent) notFound();

  // Sin password_hash
  const { password_hash: _ph, ...safeAgent } = agent;

  const actionsR = await query<ActionRow>(
    `SELECT a.id, a.task_id, t.title AS task_title, a.action_type, a.status,
            a.tokens_used, a.duration_ms, a.error, a.created_at, a.completed_at
       FROM hei_work_agent_actions a
       LEFT JOIN hei_work_tasks t ON t.id = a.task_id
      WHERE a.agent_id = $1
      ORDER BY a.created_at DESC
      LIMIT 30`,
    [agentId],
  );

  const monthTokensR = await query<{ used: number }>(
    `SELECT COALESCE(SUM(tokens_used), 0)::int AS used
       FROM hei_work_agent_actions
      WHERE agent_id = $1
        AND created_at >= date_trunc('month', NOW())`,
    [agentId],
  );
  const monthTokens = monthTokensR.rows[0]?.used ?? 0;

  const missions = await listMissions(agentId);

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href="/team"
        className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
      >
        ← Equipo
      </Link>

      <AgentEditor
        agent={safeAgent}
        actions={actionsR.rows}
        monthTokens={monthTokens}
        initialMissions={missions}
      />
    </div>
  );
}
