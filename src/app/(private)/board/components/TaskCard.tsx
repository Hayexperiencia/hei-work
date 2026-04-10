"use client";

import Link from "next/link";

import type { TaskWithAssignee } from "@/lib/queries/tasks";

interface Props {
  task: TaskWithAssignee;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  medium: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  low: "bg-neutral-500/20 text-neutral-300 border-neutral-500/40",
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

export default function TaskCard({ task, isDragging, onDragStart, onDragEnd }: Props) {
  return (
    <Link
      href={`/task/${task.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(task.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`block rounded-md border border-neutral-800 bg-neutral-950 p-3 text-left transition hover:border-neutral-700 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: task.project_color }}
          title={task.project_name}
        />
        <p className="flex-1 text-sm text-neutral-100 leading-snug">{task.title}</p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
            PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.medium
          }`}
        >
          {task.priority}
        </span>
        {task.comment_count > 0 && (
          <span className="text-[10px] text-neutral-500">{task.comment_count}c</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {task.assignee_name && (
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                task.assignee_type === "agent"
                  ? "bg-emerald-600/30 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-neutral-700 text-neutral-200"
              }`}
              title={task.assignee_name}
            >
              {initials(task.assignee_name)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
