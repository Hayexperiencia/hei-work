"use client";

import { useState } from "react";

import type { Project } from "@/lib/types";

interface Props {
  onClose: () => void;
  onCreated: (project: Project) => void;
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

export default function NewProjectModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          description: description.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error al crear");
      }
      const data = await r.json();
      onCreated(data.project);
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
        className="w-full max-w-md rounded-lg border border-[var(--border-base)] bg-[var(--bg-elevated)] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo proyecto</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          >
            ×
          </button>
        </div>
        <div className="space-y-3">
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
                    color === c ? "ring-white" : "ring-transparent"
                  }`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs text-[var(--fg-secondary)]">Descripcion (opcional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
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
            {submitting ? "Creando..." : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}
