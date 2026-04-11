"use client";

import { useState } from "react";

import type { KeyResult, Objective } from "@/lib/types";
import type { ObjectiveWithKrs } from "@/lib/queries/objectives";

interface SourceOption {
  key: string;
  label: string;
  description: string;
}

interface Props {
  initial: ObjectiveWithKrs[];
  availableSources: SourceOption[];
}

const PERIODS = ["2026", "2026-H1", "2026-H2", "Q1-2026", "Q2-2026", "Q3-2026", "Q4-2026"];
const COLORS = ["#ffcd07", "#10b981", "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899", "#ef4444"];
const METRIC_TYPES = [
  { value: "number", label: "Numero" },
  { value: "currency", label: "Moneda" },
  { value: "percentage", label: "Porcentaje" },
  { value: "boolean", label: "Si/No" },
];

function formatValue(v: number, type: string, unit: string | null): string {
  if (type === "currency") {
    return `$${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })}${unit ? " " + unit : ""}`;
  }
  if (type === "percentage") {
    return `${v.toFixed(1)}%`;
  }
  return `${v.toLocaleString("es-CO")}${unit ? " " + unit : ""}`;
}

export default function ObjectivesClient({ initial, availableSources }: Props) {
  const [objectives, setObjectives] = useState<ObjectiveWithKrs[]>(initial);
  const [editing, setEditing] = useState<ObjectiveWithKrs | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function upsertObjective(o: ObjectiveWithKrs) {
    setObjectives((prev) => {
      const idx = prev.findIndex((x) => x.id === o.id);
      if (idx === -1) return [...prev, o];
      const next = [...prev];
      next[idx] = o;
      return next;
    });
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/key-results/refresh", { method: "POST" });
      if (!r.ok) throw new Error("refresh failed");
      // Reload from API
      const gR = await fetch("/api/objectives", { cache: "no-store" });
      if (gR.ok) {
        const data = await gR.json();
        setObjectives(data.objectives ?? []);
      }
    } catch (err) {
      alert("Error: " + (err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDelete(o: ObjectiveWithKrs) {
    if (!confirm(`Eliminar el objetivo "${o.title}"?`)) return;
    try {
      const r = await fetch(`/api/objectives/${o.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
      setObjectives((prev) => prev.filter((x) => x.id !== o.id));
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold">Objetivos (OKRs)</h1>
          <p className="text-xs text-[var(--fg-muted)] mt-1">
            {objectives.length} objetivo{objectives.length === 1 ? "" : "s"} ·{" "}
            {objectives.reduce((sum, o) => sum + o.key_results.length, 0)} key results
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
          >
            {refreshing ? "Actualizando..." : "↻ Refrescar"}
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110"
          >
            + Objetivo
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {objectives.length === 0 && (
          <div className="rounded border border-dashed border-[var(--border-base)] px-4 py-12 text-center text-xs text-[var(--fg-muted)]">
            Sin objetivos todavia. Crea uno para empezar.
          </div>
        )}

        {objectives.map((o) => (
          <div
            key={o.id}
            className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span
                  className="mt-1.5 inline-block h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ background: o.color }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-[var(--fg-primary)]">{o.title}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--fg-muted)]">
                    <span>{o.period}</span>
                    <span>·</span>
                    <span className="uppercase">{o.status}</span>
                  </div>
                  {o.description && (
                    <p className="mt-1 text-xs text-[var(--fg-secondary)]">{o.description}</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold tabular-nums text-[var(--fg-primary)]">
                  {Number(o.progress).toFixed(0)}%
                </div>
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(o)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(o)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-[var(--bg-hover)]"
                  >
                    borrar
                  </button>
                </div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Number(o.progress))}%`,
                  background: o.color,
                }}
              />
            </div>

            {/* Key Results */}
            <div className="mt-4 space-y-2">
              {o.key_results.length === 0 ? (
                <div className="text-[10px] text-[var(--fg-muted)] italic">
                  Sin key results. Edita el objetivo para agregar.
                </div>
              ) : (
                o.key_results.map((kr) => {
                  const pct =
                    kr.target_value - Number(kr.start_value) === 0
                      ? 0
                      : Math.min(
                          100,
                          Math.max(
                            0,
                            ((Number(kr.current_value) - Number(kr.start_value)) /
                              (Number(kr.target_value) - Number(kr.start_value))) *
                              100,
                          ),
                        );
                  return (
                    <div key={kr.id} className="rounded border border-[var(--border-base)] bg-[var(--bg-input)] p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[var(--fg-primary)]">{kr.title}</div>
                          <div className="mt-0.5 text-[10px] text-[var(--fg-muted)]">
                            {formatValue(Number(kr.current_value), kr.metric_type, kr.unit)}
                            {" / "}
                            {formatValue(Number(kr.target_value), kr.metric_type, kr.unit)}
                            {kr.auto_source && (
                              <span className="ml-2 rounded bg-emerald-500/20 px-1 text-emerald-300">
                                auto: {kr.auto_source}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-[var(--fg-primary)]">
                          {pct.toFixed(0)}%
                        </div>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-base)]">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <ObjectiveModal
          objective={editing}
          availableSources={availableSources}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(o) => {
            upsertObjective(o);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  objective: ObjectiveWithKrs | null;
  availableSources: SourceOption[];
  onClose: () => void;
  onSaved: (o: ObjectiveWithKrs) => void;
}

interface DraftKR {
  id?: number;
  title: string;
  metric_type: string;
  current_value: number;
  target_value: number;
  start_value: number;
  unit: string;
  auto_source: string;
}

function krFromRow(kr: KeyResult): DraftKR {
  return {
    id: kr.id,
    title: kr.title,
    metric_type: kr.metric_type,
    current_value: Number(kr.current_value),
    target_value: Number(kr.target_value),
    start_value: Number(kr.start_value),
    unit: kr.unit ?? "",
    auto_source: kr.auto_source ?? "",
  };
}

function ObjectiveModal({ objective, availableSources, onClose, onSaved }: ModalProps) {
  const [title, setTitle] = useState(objective?.title ?? "");
  const [description, setDescription] = useState(objective?.description ?? "");
  const [period, setPeriod] = useState(objective?.period ?? "2026");
  const [color, setColor] = useState(objective?.color ?? "#ffcd07");
  const [krs, setKrs] = useState<DraftKR[]>(
    objective?.key_results.map(krFromRow) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addKR() {
    setKrs((prev) => [
      ...prev,
      {
        title: "",
        metric_type: "number",
        current_value: 0,
        target_value: 100,
        start_value: 0,
        unit: "",
        auto_source: "",
      },
    ]);
  }

  function updateKR(idx: number, patch: Partial<DraftKR>) {
    setKrs((prev) => prev.map((k, i) => (i === idx ? { ...k, ...patch } : k)));
  }

  function removeKR(idx: number) {
    setKrs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      let objId: number;
      if (objective) {
        const r = await fetch(`/api/objectives/${objective.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, period, color }),
        });
        if (!r.ok) throw new Error("error al guardar objetivo");
        objId = objective.id;
      } else {
        const r = await fetch("/api/objectives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, period, color }),
        });
        if (!r.ok) throw new Error("error al crear objetivo");
        const d = await r.json();
        objId = d.objective.id;
      }

      // Guardar KRs nuevos y modificados
      for (const kr of krs) {
        const body = {
          objective_id: objId,
          title: kr.title,
          metric_type: kr.metric_type,
          current_value: kr.current_value,
          target_value: kr.target_value,
          start_value: kr.start_value,
          unit: kr.unit || null,
          auto_source: kr.auto_source || null,
        };
        if (kr.id) {
          await fetch(`/api/key-results/${kr.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } else {
          await fetch("/api/key-results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      }

      // Borrar KRs que estaban antes y ya no
      if (objective) {
        const prevIds = new Set(objective.key_results.map((k) => k.id));
        const currentIds = new Set(krs.map((k) => k.id).filter(Boolean) as number[]);
        for (const prevId of prevIds) {
          if (!currentIds.has(prevId)) {
            await fetch(`/api/key-results/${prevId}`, { method: "DELETE" });
          }
        }
      }

      // Refresh to get the updated obj with progress
      const gR = await fetch(`/api/objectives/${objId}`, { cache: "no-store" });
      const gD = await gR.json();
      onSaved(gD.objective);
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
        className="w-full max-w-3xl sm:rounded-lg border-0 sm:border border-[var(--border-base)] bg-[var(--bg-elevated)] p-5 max-h-full overflow-y-auto"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {objective ? "Editar objetivo" : "Nuevo objetivo"}
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
            <span className="text-xs text-[var(--fg-secondary)]">Titulo del objetivo</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ej: Cerrar 12 unidades de ALUNA en Q2"
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs text-[var(--fg-secondary)]">Descripcion</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--fg-secondary)]">Periodo</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-xs text-[var(--fg-secondary)]">Color</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
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
          </div>

          <div className="border-t border-[var(--border-base)] pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                Key Results ({krs.length})
              </h3>
              <button
                type="button"
                onClick={addKR}
                className="rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
              >
                + KR
              </button>
            </div>
            <div className="space-y-2">
              {krs.map((kr, idx) => (
                <div
                  key={idx}
                  className="rounded border border-[var(--border-base)] bg-[var(--bg-input)] p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <input
                      value={kr.title}
                      onChange={(e) => updateKR(idx, { title: e.target.value })}
                      placeholder="Titulo del KR"
                      className="flex-1 rounded border border-[var(--border-strong)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--fg-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeKR(idx)}
                      className="rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] text-red-400 hover:bg-[var(--bg-hover)]"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <label>
                      <div className="text-[var(--fg-muted)]">Tipo</div>
                      <select
                        value={kr.metric_type}
                        onChange={(e) => updateKR(idx, { metric_type: e.target.value })}
                        className="mt-0.5 w-full rounded border border-[var(--border-strong)] bg-[var(--bg-base)] px-1 py-1 text-[var(--fg-primary)]"
                      >
                        {METRIC_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <div className="text-[var(--fg-muted)]">Actual</div>
                      <input
                        type="number"
                        value={kr.current_value}
                        onChange={(e) => updateKR(idx, { current_value: Number(e.target.value) })}
                        className="mt-0.5 w-full rounded border border-[var(--border-strong)] bg-[var(--bg-base)] px-1 py-1 text-[var(--fg-primary)]"
                      />
                    </label>
                    <label>
                      <div className="text-[var(--fg-muted)]">Meta</div>
                      <input
                        type="number"
                        value={kr.target_value}
                        onChange={(e) => updateKR(idx, { target_value: Number(e.target.value) })}
                        className="mt-0.5 w-full rounded border border-[var(--border-strong)] bg-[var(--bg-base)] px-1 py-1 text-[var(--fg-primary)]"
                      />
                    </label>
                    <label>
                      <div className="text-[var(--fg-muted)]">Unidad</div>
                      <input
                        value={kr.unit}
                        onChange={(e) => updateKR(idx, { unit: e.target.value })}
                        placeholder="ej: COP"
                        className="mt-0.5 w-full rounded border border-[var(--border-strong)] bg-[var(--bg-base)] px-1 py-1 text-[var(--fg-primary)]"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <div className="text-[10px] text-[var(--fg-muted)]">Auto-source (opcional)</div>
                    <select
                      value={kr.auto_source}
                      onChange={(e) => updateKR(idx, { auto_source: e.target.value })}
                      className="mt-0.5 w-full rounded border border-[var(--border-strong)] bg-[var(--bg-base)] px-2 py-1 text-[10px] text-[var(--fg-primary)]"
                    >
                      <option value="">(manual)</option>
                      {availableSources.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.key} — {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </div>

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
