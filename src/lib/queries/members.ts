import { query } from "@/lib/db";
import type { Member, Project } from "@/lib/types";

export interface MemberWithStats extends Member {
  active_tasks: number;
  completed_tasks_30d: number;
  tokens_used_30d: number;
}

export async function listMembers(workspaceId = 1): Promise<MemberWithStats[]> {
  const r = await query<MemberWithStats>(
    `SELECT m.id, m.workspace_id, m.name, m.email, m.type, m.role,
            m.avatar_url, m.config, m.password_hash, m.is_active, m.created_at,
            COALESCE(active.cnt, 0)::int AS active_tasks,
            COALESCE(done.cnt, 0)::int AS completed_tasks_30d,
            COALESCE(tok.tokens, 0)::int AS tokens_used_30d
       FROM hei_work_members m
       LEFT JOIN (
         SELECT assignee_id, COUNT(*)::int AS cnt
           FROM hei_work_tasks
          WHERE status IN ('backlog','in_progress','review')
          GROUP BY assignee_id
       ) active ON active.assignee_id = m.id
       LEFT JOIN (
         SELECT assignee_id, COUNT(*)::int AS cnt
           FROM hei_work_tasks
          WHERE status='done' AND completed_at > NOW() - INTERVAL '30 days'
          GROUP BY assignee_id
       ) done ON done.assignee_id = m.id
       LEFT JOIN (
         SELECT agent_id, SUM(tokens_used)::int AS tokens
           FROM hei_work_agent_actions
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY agent_id
       ) tok ON tok.agent_id = m.id
      WHERE m.workspace_id = $1 AND m.is_active = true
      ORDER BY m.type DESC, m.id`,
    [workspaceId],
  );
  return r.rows;
}

export async function listProjects(workspaceId = 1): Promise<Project[]> {
  const r = await query<Project>(
    `SELECT id, workspace_id, name, description, color, status,
            linked_cotizador_id, created_at
       FROM hei_work_projects
      WHERE workspace_id = $1 AND status = 'active'
      ORDER BY id`,
    [workspaceId],
  );
  return r.rows;
}
