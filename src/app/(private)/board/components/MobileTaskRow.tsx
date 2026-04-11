"use client";

import Link from "next/link";
import { useState } from "react";

import type { TaskWithAssignee } from "@/lib/queries/tasks";
import type { WorkflowStatus } from "@/lib/types";

interface Props {
  task: TaskWithAssignee;
  statuses: WorkflowStatus[];
  currentStatusKey: string;
  onMove: (newStatus: string) => Promise<void>;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-neutral-500",
};

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MobileTaskRow({ task, statuses, currentStatusKey, onMove }: Props) {
  const [showMove, setShowMove] = useState(false);

  async function handleMoveClick(e: React.MouseEvent, newKey: string) {
    e.preventDefault();
    e.stopPropagation();
    setShowMove(false);
    if (newKey !== currentStatusKey) {
      await onMove(newKey);
    }
  }

  return (
    <div className="relative rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)]">
      <Link
        href={`/task/${task.id}`}
        className="block p-3"
      >
        <div className="flex items-start gap-2">
          <span
            className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium}`}
            title={task.priority}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--fg-primary)] leading-snug">
              {task.title}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--fg-muted)]">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: task.project_color }}
              />
              <span className="truncate">{task.project_name}</span>
              {task.comment_count > 0 && (
                <>
                  <span>·</span>
                  <span>{task.comment_count}c</span>
                </>
              )}
              {task.due_date && (
                <>
                  <span>·</span>
                  <span>
                    {new Date(task.due_date).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
          {task.assignee_name && (
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold flex-shrink-0 ${
                task.assignee_type === "agent"
                  ? "bg-emerald-600/30 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-[var(--bg-hover)] text-[var(--fg-primary)]"
              }`}
              title={task.assignee_name}
            >
              {initials(task.assignee_name)}
            </span>
          )}
        </div>
      </Link>

      {/* Boton mover (no dentro del Link porque serian anidados) */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMove((v) => !v);
        }}
        aria-label="Mover tarea"
        className="absolute right-2 bottom-2 rounded border border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1 text-[10px] text-[var(--fg-secondary)] active:bg-[var(--bg-hover)]"
      >
        Mover ↔
      </button>

      {showMove && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMove(false)}
          />
          <div className="absolute right-2 bottom-10 z-50 w-44 overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-xl">
            {statuses.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={(e) => handleMoveClick(e, s.key)}
                disabled={s.key === currentStatusKey}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-left ${
                  s.key === currentStatusKey
                    ? "bg-[var(--bg-hover)] text-[var(--fg-muted)] cursor-default"
                    : "text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="flex-1">{s.label}</span>
                {s.key === currentStatusKey && (
                  <span className="text-[var(--fg-muted)]">•</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
