import { query, withClient } from "@/lib/db";
import type { Task, TaskPriority } from "@/lib/types";
type StatusKey = string;

export interface TaskWithAssignee extends Task {
  assignee_name: string | null;
  assignee_type: "human" | "agent" | null;
  assignee_avatar: string | null;
  project_name: string;
  project_color: string;
  comment_count: number;
}

const TASK_SELECT = `
  t.id, t.project_id, t.title, t.description, t.status, t.priority,
  t.assignee_id, t.due_date, t.labels, t.sort_order, t.task_type,
  t.metadata, t.created_by, t.created_at, t.updated_at, t.completed_at,
  m.name AS assignee_name,
  m.type AS assignee_type,
  m.avatar_url AS assignee_avatar,
  p.name AS project_name,
  p.color AS project_color,
  COALESCE(cc.cnt, 0)::int AS comment_count
`;

const TASK_FROM = `
  FROM hei_work_tasks t
  JOIN hei_work_projects p ON p.id = t.project_id
  LEFT JOIN hei_work_members m ON m.id = t.assignee_id
  LEFT JOIN (
    SELECT task_id, COUNT(*)::int AS cnt
      FROM hei_work_comments
     GROUP BY task_id
  ) cc ON cc.task_id = t.id
`;

export interface ListTasksOpts {
  workspaceId?: number;
  projectId?: number;
  status?: string;
  assigneeId?: number | "unassigned";
  tags?: string[];
  dueFrom?: string;
  dueTo?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
}

export async function listTasks(opts: ListTasksOpts = {}): Promise<TaskWithAssignee[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.workspaceId !== undefined) {
    params.push(opts.workspaceId);
    where.push(`p.workspace_id = $${params.length}`);
  }
  if (opts.projectId !== undefined) {
    params.push(opts.projectId);
    where.push(`t.project_id = $${params.length}`);
  }
  if (opts.status !== undefined) {
    params.push(opts.status);
    where.push(`t.status = $${params.length}`);
  }
  if (opts.assigneeId === "unassigned") {
    where.push(`t.assignee_id IS NULL`);
  } else if (typeof opts.assigneeId === "number") {
    params.push(opts.assigneeId);
    where.push(`t.assignee_id = $${params.length}`);
  }
  if (opts.tags && opts.tags.length > 0) {
    params.push(opts.tags);
    where.push(`t.labels && $${params.length}::text[]`);
  }
  if (opts.dueFrom) {
    params.push(opts.dueFrom);
    where.push(`t.due_date >= $${params.length}::date`);
  }
  if (opts.dueTo) {
    params.push(opts.dueTo);
    where.push(`t.due_date <= $${params.length}::date`);
  }
  if (opts.createdFrom) {
    params.push(opts.createdFrom);
    where.push(`t.created_at >= $${params.length}::timestamptz`);
  }
  if (opts.createdTo) {
    params.push(opts.createdTo);
    where.push(`t.created_at <= $${params.length}::timestamptz`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limitClause = opts.limit ? `LIMIT ${Number(opts.limit)}` : "";

  const sql = `
    SELECT ${TASK_SELECT}
    ${TASK_FROM}
    ${whereClause}
    ORDER BY t.status, t.sort_order, t.created_at
    ${limitClause}
  `;

  const r = await query<TaskWithAssignee>(sql, params);
  return r.rows;
}

export async function getTask(id: number): Promise<TaskWithAssignee | null> {
  const r = await query<TaskWithAssignee>(
    `SELECT ${TASK_SELECT} ${TASK_FROM} WHERE t.id = $1 LIMIT 1`,
    [id],
  );
  return r.rows[0] ?? null;
}

export interface CreateTaskInput {
  projectId: number;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: number | null;
  dueDate?: string | null;
  labels?: string[];
  taskType?: string;
  createdBy: number;
}

export async function createTask(input: CreateTaskInput): Promise<TaskWithAssignee> {
  const r = await query<{ id: number }>(
    `INSERT INTO hei_work_tasks
       (project_id, title, description, status, priority,
        assignee_id, due_date, labels, task_type, created_by, sort_order)
     VALUES ($1, $2, $3, 'backlog', $4, $5, $6, $7, $8, $9,
             COALESCE((SELECT MAX(sort_order)+1 FROM hei_work_tasks
                        WHERE project_id=$1 AND status='backlog'), 0))
     RETURNING id`,
    [
      input.projectId,
      input.title,
      input.description ?? null,
      input.priority ?? "medium",
      input.assigneeId ?? null,
      input.dueDate ?? null,
      input.labels ?? [],
      input.taskType ?? "manual",
      input.createdBy,
    ],
  );
  const created = await getTask(r.rows[0].id);
  if (!created) throw new Error("Task created but not found");
  return created;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: StatusKey;
  priority?: TaskPriority;
  assigneeId?: number | null;
  projectId?: number;
  dueDate?: string | null;
  labels?: string[];
  sortOrder?: number;
}

export async function updateTask(
  id: number,
  input: UpdateTaskInput,
): Promise<TaskWithAssignee | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  const push = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };

  if (input.title !== undefined) push("title", input.title);
  if (input.description !== undefined) push("description", input.description);
  if (input.status !== undefined) {
    push("status", input.status);
    // 'done' es legacy; en general el frontend marca completed_at
    // explicito via API si hace falta. Mantenemos compat con done.
    if (input.status === "done") {
      sets.push("completed_at = NOW()");
    } else {
      sets.push("completed_at = NULL");
    }
  }
  if (input.priority !== undefined) push("priority", input.priority);
  if (input.assigneeId !== undefined) push("assignee_id", input.assigneeId);
  if (input.projectId !== undefined) push("project_id", input.projectId);
  if (input.dueDate !== undefined) push("due_date", input.dueDate);
  if (input.labels !== undefined) push("labels", input.labels);
  if (input.sortOrder !== undefined) push("sort_order", input.sortOrder);

  if (sets.length === 0) {
    return getTask(id);
  }

  sets.push("updated_at = NOW()");
  params.push(id);

  await query(
    `UPDATE hei_work_tasks SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params,
  );

  return getTask(id);
}

export async function reorderTasks(
  movedId: number,
  targetStatus: StatusKey,
  orderedIds: number[],
): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query(
        `UPDATE hei_work_tasks
            SET status = $1,
                completed_at = CASE WHEN $1='done' THEN NOW() ELSE NULL END,
                updated_at = NOW()
          WHERE id = $2`,
        [targetStatus, movedId],
      );
      for (let i = 0; i < orderedIds.length; i++) {
        await c.query(
          `UPDATE hei_work_tasks SET sort_order = $1 WHERE id = $2`,
          [i, orderedIds[i]],
        );
      }
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }
  });
}
