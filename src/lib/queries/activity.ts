import { query } from "@/lib/db";

export type ActivityType =
  | "task_created"
  | "task_status_changed"
  | "task_completed"
  | "comment_created";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  created_at: string;
  task_id: number;
  task_title: string;
  project_id: number;
  project_name: string;
  project_color: string;
  actor_id: number | null;
  actor_name: string | null;
  actor_type: "human" | "agent" | null;
  payload: Record<string, unknown>;
}

export async function listRecentActivity(limit = 20): Promise<ActivityEvent[]> {
  // Union de eventos derivados: creacion de tarea, completado, comentario.
  // Para 'status_changed' usamos updated_at como heuristica si no es done
  // (pendiente: tabla de eventos dedicada en futura iteracion).
  const r = await query<ActivityEvent>(
    `
    SELECT * FROM (
      SELECT
        'task-created-' || t.id::text AS id,
        'task_created'::text AS type,
        t.created_at AS created_at,
        t.id AS task_id,
        t.title AS task_title,
        p.id AS project_id,
        p.name AS project_name,
        p.color AS project_color,
        creator.id AS actor_id,
        creator.name AS actor_name,
        creator.type AS actor_type,
        '{}'::jsonb AS payload
      FROM hei_work_tasks t
      JOIN hei_work_projects p ON p.id = t.project_id
      LEFT JOIN hei_work_members creator ON creator.id = t.created_by

      UNION ALL

      SELECT
        'task-done-' || t.id::text AS id,
        'task_completed'::text AS type,
        t.completed_at AS created_at,
        t.id AS task_id,
        t.title AS task_title,
        p.id AS project_id,
        p.name AS project_name,
        p.color AS project_color,
        assignee.id AS actor_id,
        assignee.name AS actor_name,
        assignee.type AS actor_type,
        '{}'::jsonb AS payload
      FROM hei_work_tasks t
      JOIN hei_work_projects p ON p.id = t.project_id
      LEFT JOIN hei_work_members assignee ON assignee.id = t.assignee_id
      WHERE t.completed_at IS NOT NULL

      UNION ALL

      SELECT
        'comment-' || c.id::text AS id,
        'comment_created'::text AS type,
        c.created_at AS created_at,
        c.task_id AS task_id,
        t.title AS task_title,
        p.id AS project_id,
        p.name AS project_name,
        p.color AS project_color,
        author.id AS actor_id,
        author.name AS actor_name,
        author.type AS actor_type,
        jsonb_build_object('preview', LEFT(c.body, 140)) AS payload
      FROM hei_work_comments c
      JOIN hei_work_tasks t ON t.id = c.task_id
      JOIN hei_work_projects p ON p.id = t.project_id
      LEFT JOIN hei_work_members author ON author.id = c.author_id
    ) activity
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit],
  );
  return r.rows;
}
