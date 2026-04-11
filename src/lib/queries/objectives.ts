import { query, withClient } from "@/lib/db";
import type { KeyResult, Objective, ObjectiveStatus } from "@/lib/types";

export interface ObjectiveWithKrs extends Objective {
  key_results: KeyResult[];
}

export async function listObjectives(
  workspaceId = 1,
  status?: ObjectiveStatus,
): Promise<ObjectiveWithKrs[]> {
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  const r = await query<Objective>(
    `SELECT * FROM hei_work_objectives WHERE ${where}
     ORDER BY created_at DESC`,
    params,
  );
  const objectives = r.rows;
  if (objectives.length === 0) return [];
  const ids = objectives.map((o) => o.id);
  const krR = await query<KeyResult>(
    `SELECT * FROM hei_work_key_results
      WHERE objective_id = ANY($1::int[])
      ORDER BY objective_id, position, id`,
    [ids],
  );
  const byObj = new Map<number, KeyResult[]>();
  for (const k of krR.rows) {
    if (!byObj.has(k.objective_id)) byObj.set(k.objective_id, []);
    byObj.get(k.objective_id)!.push(k);
  }
  return objectives.map((o) => ({
    ...o,
    key_results: byObj.get(o.id) ?? [],
  }));
}

export async function getObjective(id: number): Promise<ObjectiveWithKrs | null> {
  const r = await query<Objective>(
    `SELECT * FROM hei_work_objectives WHERE id = $1`,
    [id],
  );
  const obj = r.rows[0];
  if (!obj) return null;
  const krR = await query<KeyResult>(
    `SELECT * FROM hei_work_key_results WHERE objective_id = $1
     ORDER BY position, id`,
    [id],
  );
  return { ...obj, key_results: krR.rows };
}

export async function createObjective(input: {
  title: string;
  description?: string | null;
  period: string;
  ownerId?: number | null;
  color?: string;
}): Promise<Objective> {
  const r = await query<Objective>(
    `INSERT INTO hei_work_objectives
       (workspace_id, title, description, period, owner_id, color)
     VALUES (1, $1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.title.trim(),
      input.description ?? null,
      input.period,
      input.ownerId ?? null,
      input.color ?? "#ffcd07",
    ],
  );
  return r.rows[0];
}

export async function updateObjective(
  id: number,
  input: Partial<{
    title: string;
    description: string | null;
    period: string;
    status: ObjectiveStatus;
    ownerId: number | null;
    color: string;
  }>,
): Promise<Objective | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (input.title !== undefined) push("title", input.title);
  if (input.description !== undefined) push("description", input.description);
  if (input.period !== undefined) push("period", input.period);
  if (input.status !== undefined) push("status", input.status);
  if (input.ownerId !== undefined) push("owner_id", input.ownerId);
  if (input.color !== undefined) push("color", input.color);
  if (sets.length === 0) {
    const r = await query<Objective>(
      `SELECT * FROM hei_work_objectives WHERE id = $1`,
      [id],
    );
    return r.rows[0] ?? null;
  }
  params.push(id);
  const r = await query<Objective>(
    `UPDATE hei_work_objectives SET ${sets.join(", ")}
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );
  return r.rows[0] ?? null;
}

export async function deleteObjective(id: number): Promise<boolean> {
  const r = await query(`DELETE FROM hei_work_objectives WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function upsertKeyResult(input: {
  id?: number;
  objectiveId: number;
  title: string;
  metricType?: string;
  currentValue?: number;
  targetValue: number;
  startValue?: number;
  unit?: string | null;
  autoSource?: string | null;
  autoSourceArgs?: Record<string, unknown>;
  position?: number;
}): Promise<KeyResult> {
  if (input.id) {
    const r = await query<KeyResult>(
      `UPDATE hei_work_key_results
          SET title = $1,
              metric_type = $2,
              current_value = COALESCE($3, current_value),
              target_value = $4,
              start_value = COALESCE($5, start_value),
              unit = $6,
              auto_source = $7,
              auto_source_args = $8::jsonb,
              position = COALESCE($9, position)
        WHERE id = $10
        RETURNING *`,
      [
        input.title.trim(),
        input.metricType ?? "number",
        input.currentValue ?? null,
        input.targetValue,
        input.startValue ?? null,
        input.unit ?? null,
        input.autoSource ?? null,
        JSON.stringify(input.autoSourceArgs ?? {}),
        input.position ?? null,
        input.id,
      ],
    );
    return r.rows[0];
  }
  const r = await query<KeyResult>(
    `INSERT INTO hei_work_key_results
       (objective_id, title, metric_type, current_value, target_value,
        start_value, unit, auto_source, auto_source_args, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     RETURNING *`,
    [
      input.objectiveId,
      input.title.trim(),
      input.metricType ?? "number",
      input.currentValue ?? 0,
      input.targetValue,
      input.startValue ?? 0,
      input.unit ?? null,
      input.autoSource ?? null,
      JSON.stringify(input.autoSourceArgs ?? {}),
      input.position ?? 0,
    ],
  );
  return r.rows[0];
}

export async function deleteKeyResult(id: number): Promise<boolean> {
  const r = await query(`DELETE FROM hei_work_key_results WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function recomputeObjectiveProgress(objectiveId: number): Promise<number> {
  return await withClient(async (c) => {
    const r = await c.query<{ avg_pct: string }>(
      `SELECT AVG(
          CASE
            WHEN target_value - start_value = 0 THEN 0
            ELSE LEAST(100, GREATEST(0,
              (current_value - start_value) / (target_value - start_value) * 100
            ))
          END
        )::numeric(5,2) AS avg_pct
        FROM hei_work_key_results
       WHERE objective_id = $1`,
      [objectiveId],
    );
    const pct = Number(r.rows[0]?.avg_pct ?? 0);
    await c.query(
      `UPDATE hei_work_objectives SET progress = $1 WHERE id = $2`,
      [pct, objectiveId],
    );
    return pct;
  });
}
