import { query } from "@/lib/db";
import type { Project } from "@/lib/types";

export default async function BoardPage() {
  const r = await query<Project>(
    `SELECT id, workspace_id, name, description, color, status,
            linked_cotizador_id, created_at
       FROM hei_work_projects
      WHERE workspace_id = 1 AND status = 'active'
      ORDER BY id`,
  );

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Board</h1>
      <p className="text-sm text-neutral-400 mt-1">
        Sprint 1 — placeholder. El Kanban llega en Sprint 2.
      </p>

      <section className="mt-8">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">
          Proyectos del workspace
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {r.rows.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="font-medium">{p.name}</span>
              </div>
              <div className="mt-2 text-xs text-neutral-500">#{p.id}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
