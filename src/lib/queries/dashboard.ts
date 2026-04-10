import { query } from "@/lib/db";

export interface KpiSummary {
  total_tasks: number;
  active_tasks: number;
  completed_30d: number;
  overdue: number;
  completed_today: number;
  unassigned: number;
}

export interface DistributionRow {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface CompletionPoint {
  day: string; // YYYY-MM-DD
  count: number;
}

export async function getKpis(workspaceId = 1): Promise<KpiSummary> {
  const r = await query<KpiSummary>(
    `WITH t AS (
       SELECT t.* FROM hei_work_tasks t
         JOIN hei_work_projects p ON p.id = t.project_id
        WHERE p.workspace_id = $1
     )
     SELECT
       (SELECT COUNT(*)::int FROM t) AS total_tasks,
       (SELECT COUNT(*)::int FROM t WHERE status NOT IN ('done')) AS active_tasks,
       (SELECT COUNT(*)::int FROM t WHERE status='done' AND completed_at > NOW() - INTERVAL '30 days') AS completed_30d,
       (SELECT COUNT(*)::int FROM t WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE AND status <> 'done') AS overdue,
       (SELECT COUNT(*)::int FROM t WHERE status='done' AND completed_at::date = CURRENT_DATE) AS completed_today,
       (SELECT COUNT(*)::int FROM t WHERE assignee_id IS NULL AND status <> 'done') AS unassigned`,
    [workspaceId],
  );
  return r.rows[0];
}

export async function getStatusDistribution(workspaceId = 1): Promise<DistributionRow[]> {
  const r = await query<DistributionRow>(
    `SELECT s.key, s.label, s.color, COALESCE(c.cnt, 0)::int AS count
       FROM hei_work_statuses s
       LEFT JOIN (
         SELECT t.status, COUNT(*)::int AS cnt
           FROM hei_work_tasks t
           JOIN hei_work_projects p ON p.id = t.project_id
          WHERE p.workspace_id = $1
          GROUP BY t.status
       ) c ON c.status = s.key
      WHERE s.workspace_id = $1
      ORDER BY s.position`,
    [workspaceId],
  );
  return r.rows;
}

export async function getProjectDistribution(workspaceId = 1): Promise<DistributionRow[]> {
  const r = await query<DistributionRow>(
    `SELECT p.id::text AS key, p.name AS label, p.color, COALESCE(c.cnt, 0)::int AS count
       FROM hei_work_projects p
       LEFT JOIN (
         SELECT project_id, COUNT(*)::int AS cnt
           FROM hei_work_tasks
          WHERE status <> 'done'
          GROUP BY project_id
       ) c ON c.project_id = p.id
      WHERE p.workspace_id = $1 AND p.status='active'
      ORDER BY count DESC, p.id`,
    [workspaceId],
  );
  return r.rows;
}

export async function getAssigneeDistribution(workspaceId = 1): Promise<DistributionRow[]> {
  const r = await query<DistributionRow>(
    `SELECT
       COALESCE(m.id::text, 'unassigned') AS key,
       COALESCE(m.name, 'Sin asignar') AS label,
       CASE WHEN m.type='agent' THEN '#10b981' ELSE '#3b82f6' END AS color,
       COUNT(*)::int AS count
       FROM hei_work_tasks t
       JOIN hei_work_projects p ON p.id = t.project_id
       LEFT JOIN hei_work_members m ON m.id = t.assignee_id
      WHERE p.workspace_id = $1 AND t.status <> 'done'
      GROUP BY m.id, m.name, m.type
      ORDER BY count DESC
      LIMIT 10`,
    [workspaceId],
  );
  return r.rows;
}

export async function getCompletionTrend(workspaceId = 1, days = 14): Promise<CompletionPoint[]> {
  const r = await query<CompletionPoint>(
    `WITH days AS (
       SELECT generate_series(
         (CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day')::date,
         CURRENT_DATE,
         '1 day'::interval
       )::date AS day
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(c.cnt, 0)::int AS count
       FROM days d
       LEFT JOIN (
         SELECT completed_at::date AS day, COUNT(*)::int AS cnt
           FROM hei_work_tasks t
           JOIN hei_work_projects p ON p.id = t.project_id
          WHERE p.workspace_id = $1
            AND t.status='done'
            AND t.completed_at IS NOT NULL
            AND t.completed_at::date >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
          GROUP BY t.completed_at::date
       ) c ON c.day = d.day
      ORDER BY d.day`,
    [workspaceId, days],
  );
  return r.rows;
}
