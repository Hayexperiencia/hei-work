"use client";

import { useState } from "react";

import type { Project } from "@/lib/types";
import { renderMarkdown } from "@/lib/markdown";

import MarkdownEditor from "@/app/(private)/components/MarkdownEditor";

interface Props {
  initial: Project[];
  taskCounts: Record<number, number>;
}

const COLORS = [
  "#ffcd07",
  "#10b981",
  "#3b82f6",
  "#06b6d4",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
];

export default function ProjectsClient({ initial, taskCounts }: Props) {
  const [projects, setProjects] = useState(initial);
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);

  function upsert(p: Project) {
    setProjects((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx === -1) return [...prev, p];
      const next = [...prev];
      next[idx] = p;
      return next;
    });
  }

  async function handleDelete(p: Project) {
    const cnt = taskCounts[p.id] ?? 0;
    if (cnt > 0) {
      if (
        !confirm(
          `El proyecto "${p.name}" tiene ${cnt} tarea${cnt === 1 ? "" : "s"}. Si lo eliminas, las tareas tambien se eliminan.\n\n¿Continuar?`,
        )
      )
        return;
    } else {
      if (!confirm(`Eliminar el proyecto "${p.name}"?`)) return;
    }
    try {
      const r = await fetch(`/api/projects/${p.id}?force=true`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("delete failed");
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Proyectos</h1>
          <p className="text-xs text-[var(--fg-muted)] mt-1">
            {projects.length} proyecto{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110"
        >
          + Proyecto
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const cnt = taskCounts[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 inline-block h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--fg-primary)]">{p.name}</div>
                  <div className="text-xs text-[var(--fg-muted)]">
                    {cnt} tarea{cnt === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              {p.description && (
                <div
                  className="prose-app mt-3 line-clamp-3 text-xs text-[var(--fg-secondary)]"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(p.description) }}
                />
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="text-[10px] uppercase tracking-wide text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  className="text-[10px] uppercase tracking-wide text-red-400 hover:text-red-300"
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <ProjectModal
          project={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(p) => {
            upsert(p);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  project: Project | null;
  onClose: () => void;
  onSaved: (p: Project) => void;
}

function ProjectModal({ project, onClose, onSaved }: ModalProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [color, setColor] = useState(project?.color ?? COLORS[0]);
  const [description, setDescription] = useState(project?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const url = project ? `/api/projects/${project.id}` : "/api/projects";
      const method = project ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          description: description.trim() || null,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error al guardar");
      }
      const data = await r.json();
      onSaved(data.project);
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
        onSubmit={submit}
        className="w-full max-w-2xl rounded-lg border border-[var(--border-base)] bg-[var(--bg-elevated)] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {project ? "Editar proyecto" : "Nuevo proyecto"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs text-[var(--fg-secondary)]">Nombre</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
              required
            />
          </label>
          <div>
            <span className="text-xs text-[var(--fg-secondary)]">Color</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full ring-2 ${
                    color === c ? "ring-[var(--fg-primary)]" : "ring-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-[var(--fg-secondary)]">Descripcion (markdown)</span>
            <MarkdownEditor value={description} onChange={setDescription} rows={6} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-input)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
