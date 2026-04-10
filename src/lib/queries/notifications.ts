import { query } from "@/lib/db";
import type { Notification, NotificationType } from "@/lib/types";

export interface NotificationWithContext extends Notification {
  actor_name: string | null;
  actor_type: "human" | "agent" | null;
  task_title: string | null;
  project_name: string | null;
  project_color: string | null;
}

export async function listNotifications(
  recipientId: number,
  opts: { unreadOnly?: boolean; limit?: number } = {},
): Promise<NotificationWithContext[]> {
  const where: string[] = [`n.recipient_id = $1`];
  const params: unknown[] = [recipientId];
  if (opts.unreadOnly) where.push(`n.read_at IS NULL`);

  const r = await query<NotificationWithContext>(
    `SELECT n.id, n.recipient_id, n.actor_id, n.type, n.task_id, n.comment_id,
            n.payload, n.read_at, n.created_at,
            actor.name AS actor_name, actor.type AS actor_type,
            t.title AS task_title,
            p.name  AS project_name,
            p.color AS project_color
       FROM hei_work_notifications n
       LEFT JOIN hei_work_members actor ON actor.id = n.actor_id
       LEFT JOIN hei_work_tasks t ON t.id = n.task_id
       LEFT JOIN hei_work_projects p ON p.id = t.project_id
      WHERE ${where.join(" AND ")}
      ORDER BY n.created_at DESC
      LIMIT ${Math.min(opts.limit ?? 50, 200)}`,
    params,
  );
  return r.rows;
}

export async function unreadCount(recipientId: number): Promise<number> {
  const r = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM hei_work_notifications
      WHERE recipient_id = $1 AND read_at IS NULL`,
    [recipientId],
  );
  return r.rows[0]?.c ?? 0;
}

export async function markRead(recipientId: number, ids?: number[]): Promise<void> {
  if (ids && ids.length > 0) {
    await query(
      `UPDATE hei_work_notifications
          SET read_at = NOW()
        WHERE recipient_id = $1 AND id = ANY($2::int[]) AND read_at IS NULL`,
      [recipientId, ids],
    );
    return;
  }
  await query(
    `UPDATE hei_work_notifications
        SET read_at = NOW()
      WHERE recipient_id = $1 AND read_at IS NULL`,
    [recipientId],
  );
}

export async function createNotification(input: {
  recipientId: number;
  actorId?: number | null;
  type: NotificationType;
  taskId?: number | null;
  commentId?: number | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  // Evitar auto-notificacion (no notificar al autor sobre si mismo)
  if (input.actorId && input.actorId === input.recipientId) return;

  await query(
    `INSERT INTO hei_work_notifications
      (recipient_id, actor_id, type, task_id, comment_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.recipientId,
      input.actorId ?? null,
      input.type,
      input.taskId ?? null,
      input.commentId ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
}
