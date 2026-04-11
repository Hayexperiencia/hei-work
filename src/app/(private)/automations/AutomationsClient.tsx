"use client";

import { useState } from "react";

interface Rule {
  id: number;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  last_fired_at: string | null;
  fire_count: number;
}

interface Props {
  initial: Rule[];
}

const TRIGGER_LABELS: Record<string, string> = {
  webhook_ghl: "Webhook GHL",
  webhook_wasi: "Webhook Wasi",
  cron: "Cron schedule",
  task_created: "Tarea creada",
  comment_created: "Comentario creado",
};

const ACTION_LABELS: Record<string, string> = {
  create_task: "Crear tarea",
  assign_to: "Asignar a",
  notify_harry: "Notificar via Harry",
  run_agent: "Ejecutar agente",
};

export default function AutomationsClient({ initial }: Props) {
  const [rules, setRules] = useState<Rule[]>(initial);
  const [creating, setCreating] = useState(false);

  async function toggle(rule: Rule) {
    const next = !rule.is_active;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: next } : r)),
    );
    try {
      await fetch(`/api/automations/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
    } catch (err) {
      alert("Error: " + (err as Error).message);
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r)),
      );
    }
  }

  async function handleDelete(rule: Rule) {
    if (!confirm(`Eliminar la regla "${rule.name}"?`)) return;
    try {
      const r = await fetch(`/api/automations/${rule.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
      setRules((prev) => prev.filter((x) => x.id !== rule.id));
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Automatizaciones</h1>
          <p className="text-xs text-[var(--fg-muted)] mt-1">
            {rules.length} regla{rules.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110"
        >
          + Regla
        </button>
      </div>

      <div className="space-y-3">
        {rules.length === 0 && (
          <div className="rounded border border-dashed border-[var(--border-base)] px-4 py-8 text-center text-xs text-[var(--fg-muted)]">
            Sin reglas todavia.
          </div>
        )}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[var(--fg-primary)]">{rule.name}</h3>
                  {rule.is_active ? (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase text-emerald-300">
                      activa
                    </span>
                  ) : (
                    <span className="rounded bg-neutral-500/20 px-1.5 py-0.5 text-[9px] uppercase text-[var(--fg-muted)]">
                      pausada
                    </span>
                  )}
                </div>
                {rule.description && (
                  <p className="mt-1 text-xs text-[var(--fg-secondary)]">{rule.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                  <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5 text-[var(--fg-muted)]">
                    Trigger: {TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}
                  </span>
                  <span className="rounded border border-[var(--border-strong)] px-1.5 py-0.5 text-[var(--fg-muted)]">
                    Accion: {ACTION_LABELS[rule.action_type] ?? rule.action_type}
                  </span>
                  <span className="text-[var(--fg-muted)]">
                    {rule.fire_count} ejecuciones
                  </span>
                  {rule.last_fired_at && (
                    <span className="text-[var(--fg-muted)]">
                      Ultima: {new Date(rule.last_fired_at).toLocaleString("es-CO")}
                    </span>
                  )}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]">
                    Ver config
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-[var(--bg-input)] p-2 text-[10px] text-[var(--fg-secondary)]">
                    {JSON.stringify(
                      { trigger: rule.trigger_config, action: rule.action_config },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => toggle(rule)}
                  className="rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  {rule.is_active ? "Pausar" : "Activar"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule)}
                  className="rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] text-red-400 hover:bg-[var(--bg-hover)]"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-base)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--fg-secondary)]">
            <h2 className="mb-2 text-lg font-semibold text-[var(--fg-primary)]">
              Crear regla
            </h2>
            <p className="mb-3">
              Por ahora las reglas se crean via API o seed SQL. UI completa de constructor visual
              llega en Sprint 4.
            </p>
            <p className="text-xs text-[var(--fg-muted)]">
              POST <code>/api/automations</code> con JSON:
              <pre className="mt-2 rounded bg-[var(--bg-input)] p-2 text-[10px]">
{`{
  "name": "...",
  "trigger_type": "webhook_ghl",
  "trigger_config": {...},
  "action_type": "create_task",
  "action_config": {...}
}`}
              </pre>
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
