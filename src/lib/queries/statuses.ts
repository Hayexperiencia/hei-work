import { query } from "@/lib/db";
import type { WorkflowStatus } from "@/lib/types";

export async function listStatuses(workspaceId = 1): Promise<WorkflowStatus[]> {
  const r = await query<WorkflowStatus>(
    `SELECT id, workspace_id, key, label, color, position, is_default, is_terminal, created_at
       FROM hei_work_statuses
      WHERE workspace_id = $1
      ORDER BY position`,
    [workspaceId],
  );
  return r.rows;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "estado";
}

export async function createStatus(input: {
  workspaceId?: number;
  label: string;
  color?: string;
  isTerminal?: boolean;
}): Promise<WorkflowStatus> {
  const workspaceId = input.workspaceId ?? 1;
  const baseKey = slugify(input.label);
  let key = baseKey;
  let suffix = 1;
  while (true) {
    const exists = await query(
      `SELECT 1 FROM hei_work_statuses WHERE workspace_id=$1 AND key=$2`,
      [workspaceId, key],
    );
    if (exists.rowCount === 0) break;
    key = `${baseKey}_${suffix++}`;
  }

  const r = await query<WorkflowStatus>(
    `INSERT INTO hei_work_statuses (workspace_id, key, label, color, position, is_terminal)
     VALUES ($1, $2, $3, $4,
             COALESCE((SELECT MAX(position)+1 FROM hei_work_statuses WHERE workspace_id=$1), 0),
             $5)
     RETURNING id, workspace_id, key, label, color, position, is_default, is_terminal, created_at`,
    [workspaceId, key, input.label.trim(), input.color ?? "#a0a0a0", input.isTerminal ?? false],
  );
  return r.rows[0];
}

export async function updateStatus(
  id: number,
  patch: { label?: string; color?: string; position?: number; isTerminal?: boolean },
): Promise<WorkflowStatus | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, v: unknown) => {
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.label !== undefined) push("label", patch.label.trim());
  if (patch.color !== undefined) push("color", patch.color);
  if (patch.position !== undefined) push("position", patch.position);
  if (patch.isTerminal !== undefined) push("is_terminal", patch.isTerminal);
  if (sets.length === 0) {
    const r = await query<WorkflowStatus>(
      `SELECT * FROM hei_work_statuses WHERE id=$1`,
      [id],
    );
    return r.rows[0] ?? null;
  }
  params.push(id);
  const r = await query<WorkflowStatus>(
    `UPDATE hei_work_statuses SET ${sets.join(", ")} WHERE id=$${params.length}
     RETURNING id, workspace_id, key, label, color, position, is_default, is_terminal, created_at`,
    params,
  );
  return r.rows[0] ?? null;
}

export async function deleteStatus(id: number, fallbackKey: string): Promise<boolean> {
  const r = await query<WorkflowStatus>(
    `SELECT * FROM hei_work_statuses WHERE id=$1`,
    [id],
  );
  const status = r.rows[0];
  if (!status) return false;
  if (status.is_default) return false;

  // Mover tareas en este estado al fallback
  await query(`UPDATE hei_work_tasks SET status=$1 WHERE status=$2`, [
    fallbackKey,
    status.key,
  ]);
  await query(`DELETE FROM hei_work_statuses WHERE id=$1`, [id]);
  return true;
}
