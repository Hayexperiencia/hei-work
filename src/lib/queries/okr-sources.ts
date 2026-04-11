// Auto-sources para key results. Cada source lee datos de alguna fuente
// (cotizador, hei_work, ghl, wasi) y devuelve un numero.

import { query } from "@/lib/db";
import { recomputeObjectiveProgress } from "./objectives";

type Args = Record<string, unknown>;

async function cotizadorSoldUnits(args: Args): Promise<number> {
  const project = typeof args.project === "string" ? args.project : null;
  if (project) {
    const r = await query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM hei_inventory_units u
         JOIN hei_projects p ON p.id = u.project_id
        WHERE u.status = 'vendido' AND p.name ILIKE $1`,
      [`%${project}%`],
    );
    return r.rows[0]?.c ?? 0;
  }
  const r = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM hei_inventory_units WHERE status = 'vendido'`,
  );
  return r.rows[0]?.c ?? 0;
}

async function cotizadorAvailableUnits(args: Args): Promise<number> {
  const project = typeof args.project === "string" ? args.project : null;
  if (project) {
    const r = await query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM hei_inventory_units u
         JOIN hei_projects p ON p.id = u.project_id
        WHERE u.status = 'disponible' AND p.name ILIKE $1`,
      [`%${project}%`],
    );
    return r.rows[0]?.c ?? 0;
  }
  const r = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM hei_inventory_units WHERE status = 'disponible'`,
  );
  return r.rows[0]?.c ?? 0;
}

async function cotizadorRevenueMonth(): Promise<number> {
  // Si la tabla tiene columna 'price' o 'final_price'; probamos ambas
  try {
    const r = await query<{ total: string | null }>(
      `SELECT COALESCE(SUM(price), 0)::numeric(14,2) AS total
         FROM hei_inventory_units
        WHERE status = 'vendido'
          AND updated_at >= date_trunc('month', NOW())`,
    );
    return Number(r.rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

async function cotizadorRevenueYear(): Promise<number> {
  try {
    const r = await query<{ total: string | null }>(
      `SELECT COALESCE(SUM(price), 0)::numeric(14,2) AS total
         FROM hei_inventory_units
        WHERE status = 'vendido'
          AND updated_at >= date_trunc('year', NOW())`,
    );
    return Number(r.rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

async function tasksCompletedMonth(): Promise<number> {
  const r = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM hei_work_tasks
      WHERE status = 'done' AND completed_at >= date_trunc('month', NOW())`,
  );
  return r.rows[0]?.c ?? 0;
}

async function tasksCompletedByAgentsMonth(): Promise<number> {
  const r = await query<{ c: number }>(
    `SELECT COUNT(DISTINCT t.id)::int AS c
       FROM hei_work_tasks t
       JOIN hei_work_members m ON m.id = t.assignee_id
      WHERE t.status = 'done'
        AND t.completed_at >= date_trunc('month', NOW())
        AND m.type = 'agent'`,
  );
  return r.rows[0]?.c ?? 0;
}

async function agentsTokensUsedMonth(): Promise<number> {
  const r = await query<{ t: number }>(
    `SELECT COALESCE(SUM(tokens_used), 0)::int AS t
       FROM hei_work_agent_actions
      WHERE created_at >= date_trunc('month', NOW())`,
  );
  return r.rows[0]?.t ?? 0;
}

async function projectsActiveCount(): Promise<number> {
  const r = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM hei_work_projects WHERE status = 'active'`,
  );
  return r.rows[0]?.c ?? 0;
}

export const SOURCES: Record<string, (args: Args) => Promise<number>> = {
  "cotizador:sold_units": cotizadorSoldUnits,
  "cotizador:available_units": cotizadorAvailableUnits,
  "cotizador:revenue_month_cop": cotizadorRevenueMonth,
  "cotizador:revenue_year_cop": cotizadorRevenueYear,
  "tasks:completed_month": tasksCompletedMonth,
  "tasks:completed_by_agents_month": tasksCompletedByAgentsMonth,
  "agents:tokens_used_month": agentsTokensUsedMonth,
  "workspace:projects_active": projectsActiveCount,
};

export const SOURCE_INFO: Record<string, { label: string; description: string }> = {
  "cotizador:sold_units": {
    label: "Unidades vendidas (total o por proyecto)",
    description:
      "COUNT de hei_inventory_units con status='vendido'. args.project opcional filtra por nombre del proyecto.",
  },
  "cotizador:available_units": {
    label: "Unidades disponibles",
    description: "COUNT de hei_inventory_units con status='disponible'. args.project opcional.",
  },
  "cotizador:revenue_month_cop": {
    label: "Revenue del mes (COP)",
    description: "SUM(price) de unidades vendidas con updated_at >= inicio del mes actual.",
  },
  "cotizador:revenue_year_cop": {
    label: "Revenue del año (COP)",
    description: "SUM(price) de unidades vendidas desde inicio del año.",
  },
  "tasks:completed_month": {
    label: "Tareas completadas este mes",
    description: "COUNT hei_work_tasks status='done' completed_at >= inicio del mes.",
  },
  "tasks:completed_by_agents_month": {
    label: "Tareas completadas por agentes IA este mes",
    description: "Filtra las anteriores por assignee_id.type='agent'.",
  },
  "agents:tokens_used_month": {
    label: "Tokens consumidos por agentes IA este mes",
    description: "SUM(tokens_used) de hei_work_agent_actions >= inicio del mes.",
  },
  "workspace:projects_active": {
    label: "Proyectos activos en el workspace",
    description: "COUNT de hei_work_projects con status='active'.",
  },
};

export async function refreshKeyResult(keyResultId: number): Promise<{
  updated: boolean;
  value: number | null;
  source: string | null;
}> {
  const r = await query<{
    id: number;
    objective_id: number;
    auto_source: string | null;
    auto_source_args: Record<string, unknown>;
    current_value: string;
  }>(
    `SELECT id, objective_id, auto_source, auto_source_args, current_value
       FROM hei_work_key_results WHERE id = $1`,
    [keyResultId],
  );
  const kr = r.rows[0];
  if (!kr || !kr.auto_source) {
    return { updated: false, value: null, source: null };
  }
  const fn = SOURCES[kr.auto_source];
  if (!fn) return { updated: false, value: null, source: kr.auto_source };
  const value = await fn(kr.auto_source_args ?? {});
  await query(
    `UPDATE hei_work_key_results
        SET current_value = $1,
            last_updated_at = NOW()
      WHERE id = $2`,
    [value, kr.id],
  );
  await recomputeObjectiveProgress(kr.objective_id);
  return { updated: true, value, source: kr.auto_source };
}

export async function refreshAllKeyResults(): Promise<{
  total: number;
  updated: number;
  errors: Array<{ id: number; error: string }>;
}> {
  const r = await query<{ id: number }>(
    `SELECT id FROM hei_work_key_results WHERE auto_source IS NOT NULL`,
  );
  let updated = 0;
  const errors: Array<{ id: number; error: string }> = [];
  for (const row of r.rows) {
    try {
      const res = await refreshKeyResult(row.id);
      if (res.updated) updated++;
    } catch (err) {
      errors.push({ id: row.id, error: (err as Error).message });
    }
  }
  return { total: r.rows.length, updated, errors };
}
