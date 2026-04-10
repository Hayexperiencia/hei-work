"use client";

import { useEffect, useRef, useState } from "react";

import type { TaskWithAssignee } from "@/lib/queries/tasks";
import type { MemberWithStats } from "@/lib/queries/members";
import type { Project, TaskPriority } from "@/lib/types";

import TagsInput from "@/app/(private)/task/[id]/components/TagsInput";

interface Props {
  projects: Project[];
  members: MemberWithStats[];
  defaultProjectId: number | null;
  onClose: () => void;
  onCreated: (task: TaskWithAssignee) => void;
}

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export default function NewTaskModal({
  projects,
  members,
  defaultProjectId,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<number>(
    defaultProjectId ?? projects[0]?.id ?? 0,
  );
  const [assigneeId, setAssigneeId] = useState<number | "">("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim()) {
      setError("El titulo es obligatorio");
      return;
    }
    if (!projectId) {
      setError("Selecciona un proyecto");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          project_id: projectId,
          assignee_id: assigneeId === "" ? null : assigneeId,
          priority,
          description: description.trim() || undefined,
          due_date: dueDate || null,
          labels: tags,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error al crear");
      }
      const data = await r.json();
      onCreated(data.task);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nueva tarea</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-neutral-400">Titulo</span>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#ffcd07] focus:outline-none"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-neutral-400">Proyecto</span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#ffcd07] focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-neutral-400">Prioridad</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#ffcd07] focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-neutral-400">Asignar a</span>
            <select
              value={assigneeId}
              onChange={(e) =>
                setAssigneeId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#ffcd07] focus:outline-none"
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
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-neutral-400">Fecha limite</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#ffcd07] focus:outline-none"
              />
            </label>

            <div>
              <span className="text-xs text-neutral-400">Etiquetas</span>
              <TagsInput value={tags} onChange={setTags} />
            </div>
          </div>

          <label className="block">
            <span className="text-xs text-neutral-400">Descripcion (opcional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#ffcd07] focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[#ffcd07] px-4 py-2 text-sm font-semibold text-[#0a0a1a] hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Creando..." : "Crear (Enter)"}
          </button>
        </div>
      </form>
    </div>
  );
}
