"use client";

import { useState } from "react";

import type { Member } from "@/lib/types";

type SafeMember = Omit<Member, "password_hash">;

interface ActionRow {
  id: number;
  task_id: number | null;
  task_title: string | null;
  action_type: string;
  status: string;
  tokens_used: number;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Props {
  agent: SafeMember;
  actions: ActionRow[];
  monthTokens: number;
}

const AVAILABLE_TOOLS = [
  { key: "vault_read", label: "vault_read" },
  { key: "vault_list", label: "vault_list" },
  { key: "db_read", label: "db_read (cotizador)" },
  { key: "hw_read", label: "hw_read (HEI Work)" },
  { key: "harry_send", label: "harry_send" },
  { key: "agent_memory_write", label: "agent_memory_write" },
];

const PERMISSIONS = [
  { key: "can_create_tasks", label: "Crear tareas" },
  { key: "can_close_tasks", label: "Cerrar tareas (status=done)" },
  { key: "can_notify_humans", label: "Notificar humanos" },
  { key: "can_call_external_apis", label: "Llamar APIs externas" },
];

const SCHEDULES = [
  { value: "*/5 * * * *", label: "Cada 5 min" },
  { value: "*/30 * * * *", label: "Cada 30 min" },
  { value: "0 * * * *", label: "Cada hora" },
  { value: "0 2 * * *", label: "Diario 2:00 AM" },
  { value: "0 7 * * 1", label: "Lunes 7:00 AM" },
];

const MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-haiku-4-5-20251001",
  "gemini-2.5-pro",
];

interface AgentConfigUI {
  soul_text?: string;
  model?: string;
  temperature?: number;
  schedule?: string;
  budget_tokens_per_run?: number;
  budget_tokens_per_month?: number;
  tools?: string[];
  permissions?: Record<string, boolean>;
}

export default function AgentEditor({ agent, actions, monthTokens }: Props) {
  const initialConfig = (agent.config as AgentConfigUI) ?? {};
  const [config, setConfig] = useState<AgentConfigUI>({
    soul_text: initialConfig.soul_text ?? "",
    model: initialConfig.model ?? "claude-sonnet-4-6",
    temperature: initialConfig.temperature ?? 0.3,
    schedule: initialConfig.schedule ?? "0 2 * * *",
    budget_tokens_per_run: initialConfig.budget_tokens_per_run ?? 50000,
    budget_tokens_per_month: initialConfig.budget_tokens_per_month ?? 500000,
    tools: initialConfig.tools ?? [],
    permissions: initialConfig.permissions ?? {
      can_create_tasks: true,
      can_close_tasks: false,
      can_notify_humans: true,
      can_call_external_apis: true,
    },
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const monthBudget = config.budget_tokens_per_month ?? 500000;
  const pctUsed = monthBudget > 0 ? Math.min(100, (monthTokens / monthBudget) * 100) : 0;

  function patch<K extends keyof AgentConfigUI>(key: K, value: AgentConfigUI[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTool(tool: string) {
    setConfig((prev) => {
      const tools = prev.tools ?? [];
      return tools.includes(tool)
        ? { ...prev, tools: tools.filter((t) => t !== tool) }
        : { ...prev, tools: [...tools, tool] };
    });
  }

  function togglePermission(key: string) {
    setConfig((prev) => ({
      ...prev,
      permissions: {
        ...(prev.permissions ?? {}),
        [key]: !(prev.permissions ?? {})[key],
      },
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/members/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "save failed");
      }
      setSavedAt(new Date().toLocaleTimeString("es-CO"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const r = await fetch(`/api/agents/${agent.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      const result = data.result;
      setRunResult(
        `${result.status} · ${result.tokens ?? 0} tokens · ${result.message ?? ""}`,
      );
      // Refresh page after a moment
      setTimeout(() => window.location.reload(), 2500);
    } catch (err) {
      setRunResult(`Error: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-2 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--fg-primary)] truncate">{agent.name}</h1>
          <p className="text-xs text-[var(--fg-muted)] mt-1">
            {agent.role ?? "agent"} · #{agent.id}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="flex-1 sm:flex-none rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
          >
            {running ? "Ejecutando..." : "▶ Run now"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 sm:flex-none rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {(savedAt || error || runResult) && (
        <div className="space-y-1 text-xs">
          {savedAt && <p className="text-emerald-400">Guardado a las {savedAt}</p>}
          {error && <p className="text-red-400">Error: {error}</p>}
          {runResult && <p className="text-[var(--fg-secondary)]">Run: {runResult}</p>}
        </div>
      )}

      {/* Budget bar */}
      <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-[var(--fg-secondary)]">Tokens este mes</span>
          <span className="text-[var(--fg-primary)] tabular-nums">
            {monthTokens.toLocaleString("es-CO")} / {monthBudget.toLocaleString("es-CO")}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-input)]">
          <div
            className={`h-full rounded-full transition-all ${
              pctUsed >= 90 ? "bg-red-500" : pctUsed >= 70 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${pctUsed}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="order-2 lg:order-1 lg:col-span-2 space-y-4">
          {/* SOUL editor */}
          <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border-base)] px-4 py-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                SOUL.md — identidad y limites del agente
              </h3>
            </div>
            <div className="p-4">
              <textarea
                value={config.soul_text ?? ""}
                onChange={(e) => patch("soul_text", e.target.value)}
                rows={20}
                placeholder="# Identidad..."
                className="w-full resize-y rounded border border-[var(--border-base)] bg-[var(--bg-input)] p-3 text-xs font-mono text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="mt-2 text-[10px] text-[var(--fg-muted)]">
                Markdown libre. El agente lee este texto como su system prompt en cada ejecucion.
              </p>
            </div>
          </div>

          {/* Acciones recientes */}
          <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border-base)] px-4 py-3">
              <h3 className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                Historial de acciones (ultimas 30)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[var(--fg-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Tarea</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Tokens</th>
                    <th className="px-3 py-2 text-right">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[var(--fg-muted)]">
                        Sin ejecuciones todavia.
                      </td>
                    </tr>
                  )}
                  {actions.map((a) => (
                    <tr key={a.id} className="border-t border-[var(--border-base)]">
                      <td className="px-3 py-2 text-[var(--fg-muted)]">
                        {new Date(a.created_at).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">
                        {a.task_id ? (
                          <a
                            href={`/task/${a.task_id}`}
                            className="text-[var(--accent)] hover:underline"
                          >
                            {a.task_title ?? `#${a.task_id}`}
                          </a>
                        ) : (
                          <span className="text-[var(--fg-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--fg-secondary)]">
                        {a.tokens_used}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--fg-muted)]">
                        {a.duration_ms ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="order-1 lg:order-2 space-y-4">
          <Section title="Modelo y temperatura">
            <label className="block">
              <span className="text-xs text-[var(--fg-secondary)]">Modelo</span>
              <select
                value={config.model}
                onChange={(e) => patch("model", e.target.value)}
                className="mt-1 block w-full rounded border border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1.5 text-xs text-[var(--fg-primary)]"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block">
              <span className="text-xs text-[var(--fg-secondary)]">
                Temperatura: {config.temperature?.toFixed(2)}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.temperature ?? 0.3}
                onChange={(e) => patch("temperature", Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </Section>

          <Section title="Schedule (cron)">
            <select
              onChange={(e) => patch("schedule", e.target.value)}
              value={
                SCHEDULES.find((s) => s.value === config.schedule)
                  ? config.schedule
                  : ""
              }
              className="block w-full rounded border border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1.5 text-xs text-[var(--fg-primary)]"
            >
              <option value="">— preset —</option>
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({s.value})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={config.schedule ?? ""}
              onChange={(e) => patch("schedule", e.target.value)}
              placeholder="ej: 0 2 * * *"
              className="mt-2 block w-full rounded border border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1.5 text-xs font-mono text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-[var(--fg-muted)]">Hora local America/Bogota</p>
          </Section>

          <Section title="Budget">
            <label className="block">
              <span className="text-xs text-[var(--fg-secondary)]">Tokens por run</span>
              <input
                type="number"
                value={config.budget_tokens_per_run ?? 50000}
                onChange={(e) =>
                  patch("budget_tokens_per_run", Number(e.target.value))
                }
                className="mt-1 block w-full rounded border border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1.5 text-xs text-[var(--fg-primary)]"
              />
            </label>
            <label className="mt-2 block">
              <span className="text-xs text-[var(--fg-secondary)]">Tokens por mes</span>
              <input
                type="number"
                value={config.budget_tokens_per_month ?? 500000}
                onChange={(e) =>
                  patch("budget_tokens_per_month", Number(e.target.value))
                }
                className="mt-1 block w-full rounded border border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1.5 text-xs text-[var(--fg-primary)]"
              />
            </label>
          </Section>

          <Section title="Tools habilitadas">
            <div className="space-y-1">
              {AVAILABLE_TOOLS.map((t) => (
                <label key={t.key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={(config.tools ?? []).includes(t.key)}
                    onChange={() => toggleTool(t.key)}
                    className="rounded"
                  />
                  <span className="text-[var(--fg-secondary)]">{t.label}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Permisos">
            <div className="space-y-1">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean((config.permissions ?? {})[p.key])}
                    onChange={() => togglePermission(p.key)}
                    className="rounded"
                  />
                  <span className="text-[var(--fg-secondary)]">{p.label}</span>
                </label>
              ))}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-3">
      <h4 className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)] mb-2">{title}</h4>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done: "bg-emerald-500/20 text-emerald-300",
    running: "bg-blue-500/20 text-blue-300",
    failed: "bg-red-500/20 text-red-300",
    budget_exceeded: "bg-amber-500/20 text-amber-300",
    pending: "bg-neutral-500/20 text-[var(--fg-secondary)]",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
        styles[status] ?? "bg-neutral-500/20 text-[var(--fg-secondary)]"
      }`}
    >
      {status}
    </span>
  );
}
