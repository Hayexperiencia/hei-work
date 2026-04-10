import { listMembers } from "@/lib/queries/members";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function TeamPage() {
  const members = await listMembers(1);

  const humans = members.filter((m) => m.type === "human");
  const agents = members.filter((m) => m.type === "agent");

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Equipo</h1>
      <p className="text-xs text-neutral-500 mt-1">
        {humans.length} humano{humans.length === 1 ? "" : "s"} ·{" "}
        {agents.length} agente{agents.length === 1 ? "" : "s"}
      </p>

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
          Humanos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {humans.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-700 text-sm font-semibold text-white">
                  {initials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{m.name}</div>
                  <div className="text-xs text-neutral-500">{m.role ?? "—"}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-neutral-500">Activas</div>
                  <div className="text-white text-sm font-semibold">
                    {m.active_tasks}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-500">Hechas 30d</div>
                  <div className="text-white text-sm font-semibold">
                    {m.completed_tasks_30d}
                  </div>
                </div>
              </div>
              {m.email && (
                <div className="mt-2 truncate text-[10px] text-neutral-600">
                  {m.email}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
          Agentes IA
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((m) => {
            const cfg = m.config as Record<string, unknown>;
            const schedule = typeof cfg?.schedule === "string" ? cfg.schedule : null;
            return (
              <div
                key={m.id}
                className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/30 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white">{m.name}</div>
                    <div className="text-xs text-emerald-400/80">
                      {m.role ?? "agent"}
                    </div>
                  </div>
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] uppercase text-neutral-400">
                    sleeping
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-neutral-500">Activas</div>
                    <div className="text-white text-sm font-semibold">
                      {m.active_tasks}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Hechas 30d</div>
                    <div className="text-white text-sm font-semibold">
                      {m.completed_tasks_30d}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Tokens 30d</div>
                    <div className="text-white text-sm font-semibold">
                      {m.tokens_used_30d.toLocaleString("es-CO")}
                    </div>
                  </div>
                </div>
                {schedule && (
                  <div className="mt-2 font-mono text-[10px] text-neutral-600">
                    cron: {schedule}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
