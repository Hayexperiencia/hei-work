"use client";

import { useState } from "react";

import type { TaskWithAssignee } from "@/lib/queries/tasks";
import type { WorkflowStatus } from "@/lib/types";

import TaskCard from "./TaskCard";

interface Props {
  status: WorkflowStatus;
  tasks: TaskWithAssignee[];
  isDragOver: boolean;
  draggingTaskId: number | null;
  draggingStatusId: number | null;
  onTaskDrop: (statusKey: string, taskId: number) => void;
  onTaskDragStart: (taskId: number) => void;
  onTaskDragEnd: () => void;
  onStatusDragStart: (statusId: number) => void;
  onStatusDragEnd: () => void;
  onStatusReorder: (draggedId: number, targetId: number) => void;
  onStatusRename: (id: number, label: string) => void;
  onStatusDelete: (id: number) => void;
}

const STATUS_MIME = "application/x-status-id";

export default function KanbanColumn({
  status,
  tasks,
  draggingTaskId,
  draggingStatusId,
  onTaskDrop,
  onTaskDragStart,
  onTaskDragEnd,
  onStatusDragStart,
  onStatusDragEnd,
  onStatusReorder,
  onStatusRename,
  onStatusDelete,
}: Props) {
  const [hoverTask, setHoverTask] = useState(false);
  const [hoverStatus, setHoverStatus] = useState(false);
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(status.label);

  function handleSubmitRename() {
    setEditing(false);
    if (labelDraft.trim() && labelDraft !== status.label) {
      onStatusRename(status.id, labelDraft.trim());
    } else {
      setLabelDraft(status.label);
    }
  }

  return (
    <div
      className={`flex h-full w-72 flex-shrink-0 flex-col rounded-lg border bg-[var(--bg-card)] transition ${
        hoverTask
          ? "border-[var(--accent)]"
          : hoverStatus
            ? "border-[var(--accent)]/60"
            : "border-[var(--border-base)]"
      } ${draggingStatusId === status.id ? "opacity-40" : ""}`}
      onDragOver={(e) => {
        // Acepta tanto tareas como columnas
        const types = Array.from(e.dataTransfer.types);
        if (types.includes("text/plain") || types.includes(STATUS_MIME)) {
          e.preventDefault();
          if (types.includes("text/plain") && !hoverTask) setHoverTask(true);
          if (types.includes(STATUS_MIME) && !hoverStatus) setHoverStatus(true);
        }
      }}
      onDragLeave={() => {
        setHoverTask(false);
        setHoverStatus(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setHoverTask(false);
        setHoverStatus(false);
        const statusId = e.dataTransfer.getData(STATUS_MIME);
        if (statusId) {
          onStatusReorder(Number(statusId), status.id);
          return;
        }
        const taskId = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isFinite(taskId)) onTaskDrop(status.key, taskId);
      }}
    >
      {/* Header — drag handle for column reorder + rename + delete */}
      <div
        className="flex items-center justify-between gap-1 border-b border-[var(--border-base)] px-2 py-2"
        draggable={!editing}
        onDragStart={(e) => {
          if (editing) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData(STATUS_MIME, String(status.id));
          e.dataTransfer.effectAllowed = "move";
          onStatusDragStart(status.id);
        }}
        onDragEnd={onStatusDragEnd}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: status.color }}
          />
          {editing ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={handleSubmitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setLabelDraft(status.label);
                  setEditing(false);
                }
              }}
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[var(--fg-primary)] border-b border-[var(--accent)] focus:outline-none"
            />
          ) : (
            <h2
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="flex-1 min-w-0 cursor-text truncate text-sm font-semibold text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
              title="Click para renombrar"
            >
              {status.label}
            </h2>
          )}
        </div>
        <span className="rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-xs text-[var(--fg-secondary)]">
          {tasks.length}
        </span>
        {!status.is_default && !editing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStatusDelete(status.id);
            }}
            className="rounded p-1 text-[10px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-red-400"
            title="Eliminar estado"
          >
            🗑
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.length === 0 && (
          <div className="mt-8 text-center text-xs text-[var(--fg-muted)]">
            sin tareas
          </div>
        )}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            isDragging={draggingTaskId === t.id}
            onDragStart={() => onTaskDragStart(t.id)}
            onDragEnd={onTaskDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
