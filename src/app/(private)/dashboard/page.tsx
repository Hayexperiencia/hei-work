import Link from "next/link";

import { listRecentActivity, type ActivityEvent } from "@/lib/queries/activity";
import {
  getAssigneeDistribution,
  getCompletionTrend,
  getKpis,
  getProjectDistribution,
  getStatusDistribution,
} from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  task_created: "creo",
  task_status_changed: "movio",
  task_completed: "completo",
  comment_created: "comento en",
};

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "ahora";
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  return `hace ${Math.floor(diffSec / 86400)}d`;
}

export default async function DashboardPage() {
  const [kpis, statusDist, projectDist, assigneeDist, trend, events] = await Promise.all([
    getKpis(1),
    getStatusDistribution(1),
    getProjectDistribution(1),
    getAssigneeDistribution(1),
    getCompletionTrend(1, 14),
    listRecentActivity(15),
  ]);

  const trendMax = Math.max(1, ...trend.map((p) => p.count));

  return (
    <div className="px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-xs text-[var(--fg-muted)] mt-1">
          Estado del trabajo en curso
        </p>
      </div>

      {/* KPI cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Activas" value={kpis.active_tasks} accent />
        <KpiCard label="Total" value={kpis.total_tasks} />
        <KpiCard label="Hechas 30d" value={kpis.completed_30d} />
        <KpiCard label="Hechas hoy" value={kpis.completed_today} />
        <KpiCard
          label="Atrasadas"
          value={kpis.overdue}
          warn={kpis.overdue > 0}
        />
        <KpiCard
          label="Sin asignar"
          value={kpis.unassigned}
          warn={kpis.unassigned > 0}
        />
      </section>

      {/* Distribuciones */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card title="Por estado">
          <BarList rows={statusDist} />
        </Card>
        <Card title="Por proyecto (activas)">
          <BarList rows={projectDist} />
        </Card>
        <Card title="Por responsable (activas)">
          <BarList rows={assigneeDist} />
        </Card>
      </section>

      {/* Trend */}
      <section>
        <Card title="Tareas completadas — ultimos 14 dias">
          <TrendChart points={trend} max={trendMax} />
        </Card>
      </section>

      {/* Activity feed */}
      <section>
        <Card title="Actividad reciente">
          {events.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
              Sin actividad todavia.
            </div>
          )}
          <div className="divide-y divide-[var(--border-base)]">
            {events.map((e) => (
              <ActivityRow key={e.id} event={e} />
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
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
        className={`mt-1 text-3xl font-bold tabular-nums ${
          warn
            ? "text-red-400"
            : accent
              ? "text-[var(--accent)]"
              : "text-[var(--fg-primary)]"
        }`}
      >
        {value.toLocaleString("es-CO")}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)]">
      <div className="border-b border-[var(--border-base)] px-4 py-3">
        <h3 className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

interface BarRow {
  key: string;
  label: string;
  count: number;
  color: string;
}

function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) {
    return <div className="text-xs text-[var(--fg-muted)]">Sin datos</div>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-center justify-between text-xs text-[var(--fg-secondary)]">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: r.color }}
              />
              <span className="truncate">{r.label}</span>
            </div>
            <span className="tabular-nums text-[var(--fg-primary)]">{r.count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(r.count / max) * 100}%`,
                background: r.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ points, max }: { points: { day: string; count: number }[]; max: number }) {
  return (
    <div className="flex h-32 items-end gap-1">
      {points.map((p) => {
        const h = max > 0 ? (p.count / max) * 100 : 0;
        const date = new Date(p.day);
        const dayLabel = date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
        return (
          <div key={p.day} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-[var(--accent)] transition-all"
                style={{ height: `${h}%`, minHeight: p.count > 0 ? "4px" : "0" }}
                title={`${dayLabel}: ${p.count}`}
              />
            </div>
            <div className="text-[9px] text-[var(--fg-muted)]">{dayLabel.split(" ")[0]}</div>
            <div className="text-[10px] tabular-nums text-[var(--fg-secondary)]">{p.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityRow({ event: e }: { event: ActivityEvent }) {
  const preview =
    e.type === "comment_created" && typeof e.payload?.preview === "string"
      ? (e.payload.preview as string)
      : null;
  return (
    <Link
      href={`/task/${e.task_id}`}
      className="block px-4 py-3 hover:bg-[var(--bg-hover)]"
    >
      <div className="flex items-center gap-2 text-xs">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: e.project_color ?? "#a0a0a0" }}
        />
        <span className="text-[var(--fg-secondary)]">
          <span
            className={
              e.actor_type === "agent" ? "font-semibold text-emerald-300" : "font-semibold text-[var(--fg-primary)]"
            }
          >
            {e.actor_name ?? "Sistema"}
          </span>{" "}
          {TYPE_LABEL[e.type]}{" "}
          <span className="text-[var(--fg-primary)]">{e.task_title}</span>
        </span>
        <span className="ml-auto text-[var(--fg-muted)]">{timeAgo(e.created_at)}</span>
      </div>
      {preview && (
        <div className="mt-1 line-clamp-1 pl-4 text-xs text-[var(--fg-muted)]">{preview}</div>
      )}
    </Link>
  );
}
