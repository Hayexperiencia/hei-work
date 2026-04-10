"use client";

import { useState } from "react";

import type { WorkflowStatus } from "@/lib/types";

interface Props {
  onClose: () => void;
  onCreated: (status: WorkflowStatus) => void;
}

const COLORS = [
  "#a0a0a0",
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#ef4444",
];

export default function NewStatusModal({ onClose, onCreated }: Props) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [isTerminal, setIsTerminal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          color,
          is_terminal: isTerminal,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error al crear");
      }
      const data = await r.json();
      onCreated(data.status);
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
        className="w-full max-w-sm rounded-lg border border-[var(--border-base)] bg-[var(--bg-elevated)] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo estado</h2>
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
            <span className="text-xs text-[var(--fg-secondary)]">Nombre del estado</span>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
              placeholder="ej: Bloqueado, Esperando cliente"
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
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isTerminal}
              onChange={(e) => setIsTerminal(e.target.checked)}
              className="rounded border-[var(--border-strong)] bg-[var(--bg-input)]"
            />
            <span className="text-xs text-[var(--fg-secondary)]">
              Es estado final (las tareas que llegan aqui se consideran completadas)
            </span>
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
