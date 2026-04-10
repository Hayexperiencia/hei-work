import Link from "next/link";

import { listRecentActivity, type ActivityEvent } from "@/lib/queries/activity";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ActivityEvent["type"], string> = {
  task_created: "creo",
  task_status_changed: "movio",
  task_completed: "completo",
  comment_created: "comento en",
};

const TYPE_COLOR: Record<ActivityEvent["type"], string> = {
  task_created: "bg-blue-500/20 text-blue-300",
  task_status_changed: "bg-yellow-500/20 text-yellow-300",
  task_completed: "bg-emerald-500/20 text-emerald-300",
  comment_created: "bg-purple-500/20 text-purple-300",
};

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "ahora";
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  return `hace ${Math.floor(diffSec / 86400)}d`;
}

export default async function DashboardPage() {
  const events = await listRecentActivity(20);

  return (
    <div className="px-6 py-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-xs text-neutral-500 mt-1">Actividad reciente</p>

      <div className="mt-6 space-y-2">
        {events.length === 0 && (
          <div className="rounded border border-dashed border-neutral-800 px-4 py-8 text-center text-xs text-neutral-600">
            Sin actividad todavia. Crea una tarea para empezar.
          </div>
        )}
        {events.map((e) => {
          const preview =
            e.type === "comment_created" && typeof e.payload?.preview === "string"
              ? (e.payload.preview as string)
              : null;
          return (
            <Link
              href={`/task/${e.task_id}`}
              key={e.id}
              className="block rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 hover:border-neutral-700"
            >
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
                    TYPE_COLOR[e.type]
                  }`}
                >
                  {e.type.replace("task_", "").replace("_", " ")}
                </span>
                <span className="text-neutral-400">
                  <span
                    className={
                      e.actor_type === "agent" ? "text-emerald-300" : "text-white"
                    }
                  >
                    {e.actor_name ?? "—"}
                  </span>{" "}
                  {TYPE_LABEL[e.type]}{" "}
                  <span className="text-white">{e.task_title}</span>
                </span>
                <span className="ml-auto text-neutral-600">
                  {timeAgo(e.created_at)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: e.project_color }}
                />
                {e.project_name}
              </div>
              {preview && (
                <div className="mt-2 text-xs text-neutral-400 line-clamp-2">
                  {preview}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
