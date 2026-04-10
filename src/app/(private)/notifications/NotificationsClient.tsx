"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { NotificationWithContext } from "@/lib/queries/notifications";

interface Props {
  initial: NotificationWithContext[];
}

const TYPE_LABEL: Record<string, string> = {
  mention: "te menciono en",
  assigned: "te asigno",
  comment_on_my_task: "comento en tu tarea",
  task_status_changed: "movio",
};

const TYPE_COLOR: Record<string, string> = {
  mention: "bg-purple-500/20 text-purple-300",
  assigned: "bg-blue-500/20 text-blue-300",
  comment_on_my_task: "bg-emerald-500/20 text-emerald-300",
  task_status_changed: "bg-yellow-500/20 text-yellow-300",
};

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "ahora";
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  return `hace ${Math.floor(diffSec / 86400)}d`;
}

export default function NotificationsClient({ initial }: Props) {
  const [notifications, setNotifications] =
    useState<NotificationWithContext[]>(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function refetch(unreadOnly = false) {
    const r = await fetch(
      `/api/notifications${unreadOnly ? "?unread=true" : ""}`,
      { cache: "no-store" },
    );
    if (!r.ok) return;
    const data = await r.json();
    setNotifications(data.notifications ?? []);
  }

  useEffect(() => {
    refetch(filter === "unread");
  }, [filter]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    refetch(filter === "unread");
  }

  async function markOne(id: number) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notificaciones</h1>
          <p className="text-xs text-[var(--fg-muted)] mt-1">
            {unreadCount} sin leer · {notifications.length} totales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-[var(--border-base)] p-0.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded px-2 py-1 text-xs ${
                filter === "all" ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded px-2 py-1 text-xs ${
                filter === "unread" ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"
              }`}
            >
              No leidas
            </button>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-input)]"
            >
              Marcar todas
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && (
          <div className="rounded border border-dashed border-[var(--border-base)] px-4 py-8 text-center text-xs text-[var(--fg-muted)]">
            No hay notificaciones.
          </div>
        )}
        {notifications.map((n) => {
          const preview =
            typeof n.payload?.preview === "string" ? n.payload.preview : null;
          return (
            <div
              key={n.id}
              className={`rounded-lg border p-3 transition ${
                n.read_at
                  ? "border-[var(--border-base)] bg-[var(--bg-card)]"
                  : "border-[#ffcd07]/30 bg-[var(--accent)]/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
                    TYPE_COLOR[n.type] ?? "bg-[var(--bg-hover)]"
                  }`}
                >
                  {n.type.replace("_", " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--fg-primary)]">
                    <span
                      className={
                        n.actor_type === "agent"
                          ? "font-semibold text-emerald-300"
                          : "font-semibold text-[var(--fg-primary)]"
                      }
                    >
                      {n.actor_name ?? "Sistema"}
                    </span>{" "}
                    {TYPE_LABEL[n.type] ?? n.type}{" "}
                    {n.task_id && (
                      <Link
                        href={`/task/${n.task_id}`}
                        onClick={() => !n.read_at && markOne(n.id)}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {n.task_title ?? `tarea #${n.task_id}`}
                      </Link>
                    )}
                  </div>
                  {n.project_name && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--fg-muted)]">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: n.project_color ?? "#a0a0a0" }}
                      />
                      {n.project_name}
                    </div>
                  )}
                  {preview && (
                    <div className="mt-2 line-clamp-2 text-xs text-[var(--fg-secondary)]">
                      {preview}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-[var(--fg-muted)]">
                    {timeAgo(n.created_at)}
                  </span>
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={() => markOne(n.id)}
                      className="text-[10px] text-[var(--accent)] hover:underline"
                    >
                      marcar leida
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
