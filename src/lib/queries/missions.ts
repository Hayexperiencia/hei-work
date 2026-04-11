import { query } from "@/lib/db";
import type { AgentMission, MissionOutputStrategy } from "@/lib/types";

export async function listMissions(agentId?: number): Promise<AgentMission[]> {
  if (agentId !== undefined) {
    const r = await query<AgentMission>(
      `SELECT * FROM hei_work_agent_missions
        WHERE agent_id = $1
        ORDER BY id`,
      [agentId],
    );
    return r.rows;
  }
  const r = await query<AgentMission>(
    `SELECT * FROM hei_work_agent_missions ORDER BY agent_id, id`,
  );
  return r.rows;
}

export async function getMission(id: number): Promise<AgentMission | null> {
  const r = await query<AgentMission>(
    `SELECT * FROM hei_work_agent_missions WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

export interface CreateMissionInput {
  agentId: number;
  name: string;
  description?: string | null;
  instructions: string;
  schedule?: string | null;
  outputStrategy: MissionOutputStrategy;
  outputConfig?: Record<string, unknown>;
  isActive?: boolean;
}

export async function createMission(input: CreateMissionInput): Promise<AgentMission> {
  const r = await query<AgentMission>(
    `INSERT INTO hei_work_agent_missions
       (agent_id, name, description, instructions, schedule,
        output_strategy, output_config, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING *`,
    [
      input.agentId,
      input.name.trim(),
      input.description ?? null,
      input.instructions,
      input.schedule ?? null,
      input.outputStrategy,
      JSON.stringify(input.outputConfig ?? {}),
      input.isActive ?? true,
    ],
  );
  return r.rows[0];
}

export interface UpdateMissionInput {
  name?: string;
  description?: string | null;
  instructions?: string;
  schedule?: string | null;
  outputStrategy?: MissionOutputStrategy;
  outputConfig?: Record<string, unknown>;
  isActive?: boolean;
}

export async function updateMission(
  id: number,
  input: UpdateMissionInput,
): Promise<AgentMission | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown, cast?: string) => {
    params.push(val);
    sets.push(`${col} = $${params.length}${cast ? `::${cast}` : ""}`);
  };
  if (input.name !== undefined) push("name", input.name.trim());
  if (input.description !== undefined) push("description", input.description);
  if (input.instructions !== undefined) push("instructions", input.instructions);
  if (input.schedule !== undefined) push("schedule", input.schedule);
  if (input.outputStrategy !== undefined) push("output_strategy", input.outputStrategy);
  if (input.outputConfig !== undefined)
    push("output_config", JSON.stringify(input.outputConfig), "jsonb");
  if (input.isActive !== undefined) push("is_active", input.isActive);
  if (sets.length === 0) return getMission(id);
  params.push(id);
  const r = await query<AgentMission>(
    `UPDATE hei_work_agent_missions SET ${sets.join(", ")}
     WHERE id = $${params.length}
     RETURNING *`,
    params,
  );
  return r.rows[0] ?? null;
}

export async function deleteMission(id: number): Promise<boolean> {
  const r = await query(`DELETE FROM hei_work_agent_missions WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function recordMissionRun(
  id: number,
  status: "done" | "failed" | "budget_exceeded",
  actionId: number | null,
): Promise<void> {
  await query(
    `UPDATE hei_work_agent_missions
        SET last_run_at = NOW(),
            last_run_status = $1,
            last_run_action_id = $2,
            fire_count = fire_count + 1
      WHERE id = $3`,
    [status, actionId, id],
  );
}
