"use client";

import { useCallback, useEffect, useState } from "react";

import type { CommentWithAuthor } from "@/lib/queries/comments";
import type { MemberWithStats } from "@/lib/queries/members";
import type { TaskWithAssignee } from "@/lib/queries/tasks";
import type { TaskPriority, TaskStatus } from "@/lib/types";

import CommentThread from "./CommentThread";
import CommentInput from "./CommentInput";

interface Props {
  initialTask: TaskWithAssignee;
  initialComments: CommentWithAuthor[];
  members: MemberWithStats[];
}

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "En progreso" },
  { value: "review", label: "Revision" },
  { value: "done", label: "Hecho" },
];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export default function TaskDetail({ initialTask, initialComments, members }: Props) {
  const [task, setTask] = useState(initialTask);
  const [comments, setComments] = useState(initialComments);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(task.description ?? "");
  const [savingDesc, setSavingDesc] = useState(false);

  const fetchComments = useCallback(async () => {
    const r = await fetch(`/api/tasks/${task.id}/comments`, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    setComments(data.comments ?? []);
  }, [task.id]);

  // Polling cada 10s para comentarios nuevos
  useEffect(() => {
    const i = setInterval(fetchComments, 10_000);
    return () => clearInterval(i);
  }, [fetchComments]);

  async function patchTask(patch: Record<string, unknown>) {
    const r = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data.task) setTask(data.task);
    return data.task as TaskWithAssignee;
  }

  async function saveTitle() {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== task.title) {
      await patchTask({ title: titleDraft.trim() });
    } else {
      setTitleDraft(task.title);
    }
  }

  async function saveDesc() {
    if (descDraft === (task.description ?? "")) return;
    setSavingDesc(true);
    await patchTask({ description: descDraft });
    setSavingDesc(false);
  }

  async function handleStatusChange(status: TaskStatus) {
    await patchTask({ status });
  }

  async function handlePriorityChange(priority: TaskPriority) {
    await patchTask({ priority });
  }

  async function handleAssigneeChange(value: string) {
    const id = value === "" ? null : Number(value);
    await patchTask({ assignee_id: id });
  }

  async function handleCommentCreated(c: CommentWithAuthor) {
    setComments((prev) => [...prev, c]);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: task.project_color }}
        />
        {task.project_name} · #{task.id}
      </div>

      {editingTitle ? (
        <input
          value={titleDraft}
          autoFocus
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTitleDraft(task.title);
              setEditingTitle(false);
            }
          }}
          className="w-full bg-transparent text-2xl font-semibold text-white border-b border-[#ffcd07] focus:outline-none"
        />
      ) : (
        <h1
          onClick={() => setEditingTitle(true)}
          className="cursor-text text-2xl font-semibold text-white hover:bg-neutral-900/40 rounded px-1 -mx-1"
          title="Click para editar"
        >
          {task.title}
        </h1>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Estado</div>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white focus:border-[#ffcd07] focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Prioridad</div>
          <select
            value={task.priority}
            onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white focus:border-[#ffcd07] focus:outline-none"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Asignado</div>
          <select
            value={task.assignee_id ?? ""}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-white focus:border-[#ffcd07] focus:outline-none"
          >
            <option value="">Sin asignar</option>
            <optgroup label="Humanos">
              {members
                .filter((m) => m.type === "human")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Agentes">
              {members
                .filter((m) => m.type === "agent")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Creada</div>
          <div className="mt-1 text-xs text-neutral-400">
            {new Date(task.created_at).toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "short",
            })}
          </div>
        </div>
      </div>

      <section className="mt-6">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">
          Descripcion {savingDesc && <span className="text-neutral-600">guardando...</span>}
        </div>
        <textarea
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={saveDesc}
          rows={4}
          placeholder="Sin descripcion. Click para escribir."
          className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 p-3 text-sm text-white focus:border-[#ffcd07] focus:outline-none"
        />
      </section>

      <section className="mt-8">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-2">
          Hilo · {comments.length} comentario{comments.length === 1 ? "" : "s"}
        </div>
        <CommentThread comments={comments} />
        <CommentInput taskId={task.id} onCreated={handleCommentCreated} />
      </section>
    </div>
  );
}
