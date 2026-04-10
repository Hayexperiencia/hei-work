"use client";

import { useState } from "react";

import type { TaskWithAssignee } from "@/lib/queries/tasks";

import TaskCard from "./TaskCard";

interface Props {
  status: string;
  label: string;
  color?: string;
  tasks: TaskWithAssignee[];
  onDrop: (status: string, taskId: number) => void;
  onDragStart: (taskId: number) => void;
  onDragEnd: () => void;
  draggingId: number | null;
}

export default function KanbanColumn({
  status,
  label,
  color,
  tasks,
  onDrop,
  onDragStart,
  onDragEnd,
  draggingId,
}: Props) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className={`flex h-full w-72 flex-shrink-0 flex-col rounded-lg border ${
        hover ? "border-[#ffcd07]" : "border-neutral-800"
      } bg-neutral-900/40`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!hover) setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const id = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isFinite(id)) onDrop(status, id);
      }}
    >
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-2">
          {color && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: color }}
            />
          )}
          <h2 className="text-sm font-semibold text-neutral-300">{label}</h2>
        </div>
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.length === 0 && (
          <div className="mt-8 text-center text-xs text-neutral-600">
            sin tareas
          </div>
        )}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            isDragging={draggingId === t.id}
            onDragStart={() => onDragStart(t.id)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
