import { query } from "@/lib/db";
import type { Comment } from "@/lib/types";

export interface CommentWithAuthor extends Comment {
  author_name: string | null;
  author_type: "human" | "agent" | null;
  author_avatar: string | null;
}

export async function listCommentsByTask(taskId: number): Promise<CommentWithAuthor[]> {
  const r = await query<CommentWithAuthor>(
    `SELECT c.id, c.task_id, c.author_id, c.body, c.metadata, c.created_at,
            m.name AS author_name,
            m.type AS author_type,
            m.avatar_url AS author_avatar
       FROM hei_work_comments c
       LEFT JOIN hei_work_members m ON m.id = c.author_id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC`,
    [taskId],
  );
  return r.rows;
}

export async function createComment(input: {
  taskId: number;
  authorId: number;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<CommentWithAuthor> {
  const r = await query<{ id: number }>(
    `INSERT INTO hei_work_comments (task_id, author_id, body, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [
      input.taskId,
      input.authorId,
      input.body,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const r2 = await query<CommentWithAuthor>(
    `SELECT c.id, c.task_id, c.author_id, c.body, c.metadata, c.created_at,
            m.name AS author_name,
            m.type AS author_type,
            m.avatar_url AS author_avatar
       FROM hei_work_comments c
       LEFT JOIN hei_work_members m ON m.id = c.author_id
      WHERE c.id = $1`,
    [r.rows[0].id],
  );
  return r2.rows[0];
}
