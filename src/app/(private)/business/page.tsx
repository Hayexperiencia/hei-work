import Link from "next/link";

import { query } from "@/lib/db";
import { listObjectives } from "@/lib/queries/objectives";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProjectSummary {
  id: number;
  name: string;
  available: number;
  sold: number;
  reserved: number;
  total: number;
}

interface BusinessData {
  total_sold: number;
  total_available: number;
  total_units: number;
  revenue_month: number;
  revenue_year: number;
  projects: ProjectSummary[];
  active_tasks: number;
  completed_this_month: number;
  completed_by_agents_month: number;
  overdue_tasks: number;
  active_objectives: number;
  objectives_progress_avg: number;
}

async function loadBusinessData(): Promise<BusinessData> {
  // Intentamos cargar todo en paralelo. Si alguna query falla, devolvemos 0.
  const [projectsR, soldR, availR, revenueMonthR, revenueYearR, tasksR, objectivesR] =
    await Promise.all([
      safeQuery<ProjectSummary>(
        `SELECT p.id, p.name,
                COALESCE(SUM(CASE WHEN u.status='disponible' THEN 1 ELSE 0 END), 0)::int AS available,
                COALESCE(SUM(CASE WHEN u.status='vendido' THEN 1 ELSE 0 END), 0)::int AS sold,
                COALESCE(SUM(CASE WHEN u.status='reservado' THEN 1 ELSE 0 END), 0)::int AS reserved,
                COUNT(u.id)::int AS total
           FROM hei_projects p
           LEFT JOIN hei_inventory_units u ON u.project_id = p.id
          GROUP BY p.id, p.name
          ORDER BY p.id`,
      ),
      safeQuery<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM hei_inventory_units WHERE status = 'vendido'`,
      ),
      safeQuery<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM hei_inventory_units WHERE status = 'disponible'`,
      ),
      safeQuery<{ total: string | null }>(
        `SELECT COALESCE(SUM(price),0)::numeric(14,2) AS total
           FROM hei_inventory_units
          WHERE status = 'vendido' AND updated_at >= date_trunc('month', NOW())`,
      ),
      safeQuery<{ total: string | null }>(
        `SELECT COALESCE(SUM(price),0)::numeric(14,2) AS total
           FROM hei_inventory_units
          WHERE status = 'vendido' AND updated_at >= date_trunc('year', NOW())`,
      ),
      safeQuery<{
        active: number;
        month: number;
        agents: number;
        overdue: number;
      }>(
        `SELECT
           (SELECT COUNT(*)::int FROM hei_work_tasks WHERE status NOT IN ('done')) AS active,
           (SELECT COUNT(*)::int FROM hei_work_tasks
             WHERE status='done' AND completed_at >= date_trunc('month', NOW())) AS month,
           (SELECT COUNT(*)::int FROM hei_work_tasks t
              JOIN hei_work_members m ON m.id = t.assignee_id
             WHERE t.status='done' AND t.completed_at >= date_trunc('month', NOW())
               AND m.type='agent') AS agents,
           (SELECT COUNT(*)::int FROM hei_work_tasks
             WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE
               AND status NOT IN ('done')) AS overdue`,
      ),
      listObjectives(1, "active").catch(() => []),
    ]);

  const totalProjectsUnits = (projectsR ?? []).reduce((s, p) => s + p.total, 0);

  const objectives = objectivesR ?? [];
  const avgProgress =
    objectives.length === 0
      ? 0
      : objectives.reduce((s, o) => s + Number(o.progress), 0) / objectives.length;

  return {
    total_sold: soldR?.[0]?.c ?? 0,
    total_available: availR?.[0]?.c ?? 0,
    total_units: totalProjectsUnits,
    revenue_month: Number(revenueMonthR?.[0]?.total ?? 0),
    revenue_year: Number(revenueYearR?.[0]?.total ?? 0),
    projects: projectsR ?? [],
    active_tasks: tasksR?.[0]?.active ?? 0,
    completed_this_month: tasksR?.[0]?.month ?? 0,
    completed_by_agents_month: tasksR?.[0]?.agents ?? 0,
    overdue_tasks: tasksR?.[0]?.overdue ?? 0,
    active_objectives: objectives.length,
    objectives_progress_avg: avgProgress,
  };
}

async function safeQuery<T>(sql: string): Promise<T[]> {
  try {
    const r = await query(sql);
    return r.rows as T[];
  } catch {
    return [];
  }
}

function fmt(n: number): string {
  return n.toLocaleString("es-CO");
}

function fmtCOP(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default async function BusinessPage() {
  const data = await loadBusinessData();

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold">Negocio</h1>
        <p className="text-xs text-[var(--fg-muted)] mt-1">
          Vision consolidada del negocio — cotizador + tareas + objetivos
        </p>
      </div>

      {/* Top KPIs */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <BigKpi
          label="Unidades vendidas"
          value={fmt(data.total_sold)}
          sub={`de ${fmt(data.total_units)} totales`}
          accent
        />
        <BigKpi
          label="Revenue mes"
          value={fmtCOP(data.revenue_month)}
          sub={`año: ${fmtCOP(data.revenue_year)}`}
        />
        <BigKpi
          label="Unidades disponibles"
          value={fmt(data.total_available)}
          sub="listas para vender"
        />
        <BigKpi
          label="Tareas activas"
          value={fmt(data.active_tasks)}
          sub={`${data.completed_this_month} hechas este mes`}
        />
        <BigKpi
          label="OKRs activos"
          value={fmt(data.active_objectives)}
          sub={`${data.objectives_progress_avg.toFixed(0)}% progreso avg`}
          warn={data.active_objectives === 0}
        />
      </section>

      {/* Alerts */}
      {(data.overdue_tasks > 0 || data.total_available === 0) && (
        <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <h2 className="text-xs uppercase tracking-wide text-red-400 mb-2">Alertas</h2>
          <ul className="space-y-1 text-xs text-[var(--fg-secondary)]">
            {data.overdue_tasks > 0 && (
              <li>
                • <strong>{data.overdue_tasks} tareas atrasadas</strong> (due_date &lt; hoy).{" "}
                <Link href="/board" className="text-[var(--accent)] underline">
                  revisar board
                </Link>
              </li>
            )}
            {data.total_available === 0 && (
              <li>
                • <strong>Sin unidades disponibles</strong> en el cotizador — revisar inventario
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Por proyecto */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-3">
          Por proyecto (cotizador)
        </h2>
        {data.projects.length === 0 ? (
          <div className="rounded border border-dashed border-[var(--border-base)] px-4 py-8 text-center text-xs text-[var(--fg-muted)]">
            Sin datos del cotizador disponibles.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.projects.map((p) => {
              const pctSold = p.total > 0 ? (p.sold / p.total) * 100 : 0;
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4"
                >
                  <div className="text-sm font-semibold text-[var(--fg-primary)]">{p.name}</div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                    <div>
                      <div className="text-[var(--fg-muted)]">Disp</div>
                      <div className="tabular-nums text-[var(--fg-primary)]">{p.available}</div>
                    </div>
                    <div>
                      <div className="text-[var(--fg-muted)]">Reserv</div>
                      <div className="tabular-nums text-[var(--fg-primary)]">{p.reserved}</div>
                    </div>
                    <div>
                      <div className="text-[var(--fg-muted)]">Vend</div>
                      <div className="tabular-nums text-emerald-400">{p.sold}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[10px] text-[var(--fg-muted)] flex items-center justify-between">
                      <span>vendido</span>
                      <span>{pctSold.toFixed(0)}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pctSold}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Team activity */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-3">
          Actividad del equipo (HEI Work)
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniKpi label="Activas" value={fmt(data.active_tasks)} />
          <MiniKpi label="Hechas mes" value={fmt(data.completed_this_month)} />
          <MiniKpi label="Hechas por IA" value={fmt(data.completed_by_agents_month)} />
          <MiniKpi
            label="Atrasadas"
            value={fmt(data.overdue_tasks)}
            warn={data.overdue_tasks > 0}
          />
        </div>
      </section>

      <p className="text-[10px] text-[var(--fg-muted)] text-center pt-4">
        Los datos se refrescan al cargar la pagina. Refresca el navegador o navega a otra pestaña
        para actualizar.
      </p>
    </div>
  );
}

function BigKpi({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        warn
          ? "border-red-500/30 bg-red-500/5"
          : accent
            ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
            : "border-[var(--border-base)] bg-[var(--bg-card)]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          warn
            ? "text-red-400"
            : accent
              ? "text-[var(--accent)]"
              : "text-[var(--fg-primary)]"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[10px] text-[var(--fg-muted)]">{sub}</div>}
    </div>
  );
}

function MiniKpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={`rounded border p-3 ${
        warn
          ? "border-red-500/30 bg-red-500/5"
          : "border-[var(--border-base)] bg-[var(--bg-card)]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">{label}</div>
      <div
        className={`mt-0.5 text-lg font-bold tabular-nums ${
          warn ? "text-red-400" : "text-[var(--fg-primary)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
