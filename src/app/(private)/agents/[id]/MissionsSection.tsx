"use client";

import { useState } from "react";

import type { AgentMission, MissionOutputStrategy } from "@/lib/types";

interface Props {
  agentId: number;
  initial: AgentMission[];
  defaultSchedule: string | null;
}

const STRATEGIES: Array<{ value: MissionOutputStrategy; label: string; hint: string }> = [
  {
    value: "comment",
    label: "Comentario en tarea fija",
    hint: "Agrega el resultado como comentario en una tarea existente (task_id)",
  },
  {
    value: "new_task",
    label: "Crear nueva tarea",
    hint: "Crea una tarea nueva con el resultado como descripcion",
  },
  {
    value: "vault_note",
    label: "Nota en el vault",
    hint: "Escribe el resultado como archivo markdown en /vault (path_template con {date})",
  },
  {
    value: "harry_send",
    label: "Mensaje via Harry",
    hint: "Envia el resultado a Telegram/WhatsApp (channel, to)",
  },
];

const SCHEDULE_PRESETS = [
  { value: "*/30 * * * *", label: "Cada 30 min" },
  { value: "0 * * * *", label: "Cada hora" },
  { value: "0 2 * * *", label: "Diario 2:00 AM" },
  { value: "0 7 * * 1", label: "Lunes 7:00 AM" },
  { value: "0 9 * * 1", label: "Lunes 9:00 AM" },
  { value: "", label: "(heredar del agente)" },
];

export default function MissionsSection({ agentId, initial, defaultSchedule }: Props) {
  const [missions, setMissions] = useState<AgentMission[]>(initial);
  const [editing, setEditing] = useState<AgentMission | null>(null);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);

  function upsert(m: AgentMission) {
    setMissions((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx === -1) return [...prev, m];
      const next = [...prev];
      next[idx] = m;
      return next;
    });
  }

  async function toggleActive(m: AgentMission) {
    const next = !m.is_active;
    setMissions((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, is_active: next } : x)),
    );
    try {
      await fetch(`/api/missions/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
    } catch (err) {
      alert("Error: " + (err as Error).message);
      setMissions((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, is_active: m.is_active } : x)),
      );
    }
  }

  async function runNow(m: AgentMission) {
    setRunningId(m.id);
    try {
      const r = await fetch(`/api/missions/${m.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      const result = data.result;
      alert(
        `${result.status} · ${result.tokens ?? 0} tokens\n${result.message ?? ""}`,
      );
      // Refresh for last_run update
      window.location.reload();
    } catch (err) {
      alert("Error: " + (err as Error).message);
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(m: AgentMission) {
    if (!confirm(`Eliminar la mision "${m.name}"?`)) return;
    try {
      const r = await fetch(`/api/missions/${m.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
      setMissions((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)]">
      <div className="flex items-center justify-between border-b border-[var(--border-base)] px-4 py-3">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
            Misiones recurrentes (skills)
          </h3>
          <p className="text-[10px] text-[var(--fg-muted)] mt-0.5">
            Trabajos programados que el agente ejecuta automaticamente en su schedule
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-fg)] hover:brightness-110"
        >
          + Mision
        </button>
      </div>

      <div className="p-3 space-y-2">
        {missions.length === 0 && (
          <div className="rounded border border-dashed border-[var(--border-base)] px-3 py-6 text-center text-xs text-[var(--fg-muted)]">
            Sin misiones. Crea una para que este agente trabaje automaticamente sin tareas
            asignadas.
          </div>
        )}
        {missions.map((m) => {
          const strategy = STRATEGIES.find((s) => s.value === m.output_strategy);
          return (
            <div
              key={m.id}
              className={`rounded border p-3 ${
                m.is_active
                  ? "border-[var(--border-base)] bg-[var(--bg-input)]"
                  : "border-[var(--border-base)] bg-[var(--bg-input)] opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-medium text-[var(--fg-primary)]">
                      {m.name}
                    </h4>
                    {m.is_active ? (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase text-emerald-300">
                        activa
                      </span>
                    ) : (
                      <span className="rounded bg-neutral-500/20 px-1.5 py-0.5 text-[9px] uppercase text-[var(--fg-muted)]">
                        pausada
                      </span>
                    )}
                  </div>
                  {m.description && (
                    <p className="mt-1 text-xs text-[var(--fg-secondary)] line-clamp-2">
                      {m.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--fg-muted)]">
                    <span>
                      cron:{" "}
                      <span className="font-mono">
                        {m.schedule ?? defaultSchedule ?? "—"}
                      </span>
                    </span>
                    <span>output: {strategy?.label ?? m.output_strategy}</span>
                    <span>
                      runs: <span className="font-mono">{m.fire_count}</span>
                    </span>
                    {m.last_run_at && (
                      <span>
                        ultimo:{" "}
                        <span className={m.last_run_status === "done" ? "text-emerald-400" : "text-red-400"}>
                          {m.last_run_status}
                        </span>{" "}
                        {new Date(m.last_run_at).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => runNow(m)}
                    disabled={runningId === m.id}
                    className="rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  >
                    {runningId === m.id ? "..." : "▶"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(m)}
                    className="rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(m)}
                    className="rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    {m.is_active ? "⏸" : "⏵"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(m)}
                    className="rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] text-red-400 hover:bg-[var(--bg-hover)]"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <MissionModal
          agentId={agentId}
          mission={editing}
          defaultSchedule={defaultSchedule}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(m) => {
            upsert(m);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  agentId: number;
  mission: AgentMission | null;
  defaultSchedule: string | null;
  onClose: () => void;
  onSaved: (m: AgentMission) => void;
}

function MissionModal({
  agentId,
  mission,
  defaultSchedule,
  onClose,
  onSaved,
}: ModalProps) {
  const [name, setName] = useState(mission?.name ?? "");
  const [description, setDescription] = useState(mission?.description ?? "");
  const [instructions, setInstructions] = useState(mission?.instructions ?? "");
  const [schedule, setSchedule] = useState(mission?.schedule ?? "");
  const [strategy, setStrategy] = useState<MissionOutputStrategy>(
    mission?.output_strategy ?? "comment",
  );
  const [outputConfig, setOutputConfig] = useState<Record<string, unknown>>(
    mission?.output_config ?? {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateConfig(key: string, value: unknown) {
    setOutputConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !instructions.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const url = mission ? `/api/missions/${mission.id}` : "/api/missions";
      const method = mission ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          name,
          description: description || null,
          instructions,
          schedule: schedule || null,
          output_strategy: strategy,
          output_config: outputConfig,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error al guardar");
      }
      const data = await r.json();
      onSaved(data.mission);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/70 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-2xl sm:rounded-lg border-0 sm:border border-[var(--border-base)] bg-[var(--bg-elevated)] p-5 max-h-full overflow-y-auto"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mission ? "Editar mision" : "Nueva mision"}
          </h2>
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
            <span className="text-xs text-[var(--fg-secondary)]">Nombre de la mision</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Auditoria semanal de inventario"
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs text-[var(--fg-secondary)]">Descripcion corta</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="(opcional) para que sirve"
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
            />
          </label>

          <label className="block">
            <span className="text-xs text-[var(--fg-secondary)]">
              Instrucciones (prompt que recibe el agente)
            </span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={8}
              placeholder={`Ejemplo:

1. Lee hei_inventory_units con db_read y cuenta disponibles por proyecto
2. Compara con tu memoria 'inventario_baseline_{proyecto}'
3. Si hay cambios significativos (>10%), reporta en TL;DR
4. Actualiza la memoria con los nuevos valores

Formato de salida:
## TL;DR
- ...
## Datos
- ...
## Acciones`}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs text-[var(--fg-secondary)]">Schedule (cron)</span>
            <select
              value={SCHEDULE_PRESETS.find((s) => s.value === schedule) ? schedule : ""}
              onChange={(e) => setSchedule(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
            >
              <option value="">— preset —</option>
              {SCHEDULE_PRESETS.map((s) => (
                <option key={s.value || "inherit"} value={s.value}>
                  {s.label} {s.value && `(${s.value})`}
                </option>
              ))}
            </select>
            <input
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder={`cron custom o vacio para heredar "${defaultSchedule ?? "—"}"`}
              className="mt-2 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono text-[var(--fg-primary)]"
            />
          </label>

          <div>
            <span className="text-xs text-[var(--fg-secondary)]">Estrategia de output</span>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as MissionOutputStrategy)}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-[var(--fg-muted)]">
              {STRATEGIES.find((s) => s.value === strategy)?.hint}
            </p>
          </div>

          {strategy === "comment" && (
            <label className="block">
              <span className="text-xs text-[var(--fg-secondary)]">ID de la tarea fija</span>
              <input
                type="number"
                value={(outputConfig.task_id as number) ?? ""}
                onChange={(e) => updateConfig("task_id", Number(e.target.value))}
                placeholder="ej: 42"
                className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
              />
            </label>
          )}

          {strategy === "new_task" && (
            <>
              <label className="block">
                <span className="text-xs text-[var(--fg-secondary)]">ID del proyecto</span>
                <input
                  type="number"
                  value={(outputConfig.project_id as number) ?? ""}
                  onChange={(e) => updateConfig("project_id", Number(e.target.value))}
                  placeholder="ej: 1 (HEI OS)"
                  className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
                />
              </label>
              <label className="block">
                <span className="text-xs text-[var(--fg-secondary)]">Plantilla de titulo</span>
                <input
                  value={(outputConfig.title_template as string) ?? ""}
                  onChange={(e) => updateConfig("title_template", e.target.value)}
                  placeholder="ej: Reporte {date} · {mission}"
                  className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
                />
              </label>
            </>
          )}

          {strategy === "vault_note" && (
            <label className="block">
              <span className="text-xs text-[var(--fg-secondary)]">
                Ruta en el vault (con {`{date}`} para fecha)
              </span>
              <input
                value={(outputConfig.path_template as string) ?? ""}
                onChange={(e) => updateConfig("path_template", e.target.value)}
                placeholder="informes/semanal/{date}.md"
                className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono text-[var(--fg-primary)]"
              />
            </label>
          )}

          {strategy === "harry_send" && (
            <>
              <label className="block">
                <span className="text-xs text-[var(--fg-secondary)]">Canal</span>
                <select
                  value={(outputConfig.channel as string) ?? "telegram"}
                  onChange={(e) => updateConfig("channel", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
                >
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-[var(--fg-secondary)]">Destinatario (chat_id)</span>
                <input
                  value={(outputConfig.to as string) ?? ""}
                  onChange={(e) => updateConfig("to", e.target.value)}
                  placeholder="ej: 123456789"
                  className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
                />
              </label>
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
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
