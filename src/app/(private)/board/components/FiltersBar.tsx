"use client";

import { useState } from "react";

import type { MemberWithStats } from "@/lib/queries/members";
import type { Project } from "@/lib/types";

import type { BoardFilters } from "./KanbanBoard";

interface Props {
  projects: Project[];
  members: MemberWithStats[];
  filters: BoardFilters;
  onApply: (next: BoardFilters) => void;
}

export default function FiltersBar({ projects, members, filters, onApply }: Props) {
  const [draft, setDraft] = useState<BoardFilters>(filters);
  const [tagDraft, setTagDraft] = useState("");

  function set<K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onApply(next);
  }

  function addTag() {
    const t = tagDraft.trim();
    if (!t) return;
    if (draft.tags.includes(t)) return;
    set("tags", [...draft.tags, t]);
    setTagDraft("");
  }

  function removeTag(t: string) {
    set("tags", draft.tags.filter((x) => x !== t));
  }

  function clearAll() {
    const empty: BoardFilters = {
      project: null,
      assignee: null,
      tags: [],
      dueFrom: "",
      dueTo: "",
      createdFrom: "",
      createdTo: "",
    };
    setDraft(empty);
    onApply(empty);
  }

  const hasFilters =
    !!draft.project ||
    !!draft.assignee ||
    draft.tags.length > 0 ||
    !!draft.dueFrom ||
    !!draft.dueTo ||
    !!draft.createdFrom ||
    !!draft.createdTo;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <Field label="Proyecto">
        <select
          value={draft.project ?? ""}
          onChange={(e) =>
            set("project", e.target.value ? Number(e.target.value) : null)
          }
          className="filterSelect"
        >
          <option value="">Todos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Asignado">
        <select
          value={draft.assignee ?? ""}
          onChange={(e) => set("assignee", e.target.value || null)}
          className="filterSelect"
        >
          <option value="">Todos</option>
          <option value="unassigned">Sin asignar</option>
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
      </Field>

      <Field label="Limite desde">
        <input
          type="date"
          value={draft.dueFrom}
          onChange={(e) => set("dueFrom", e.target.value)}
          className="filterSelect"
        />
      </Field>

      <Field label="Limite hasta">
        <input
          type="date"
          value={draft.dueTo}
          onChange={(e) => set("dueTo", e.target.value)}
          className="filterSelect"
        />
      </Field>

      <Field label="Creada desde">
        <input
          type="date"
          value={draft.createdFrom}
          onChange={(e) => set("createdFrom", e.target.value)}
          className="filterSelect"
        />
      </Field>

      <Field label="Creada hasta">
        <input
          type="date"
          value={draft.createdTo}
          onChange={(e) => set("createdTo", e.target.value)}
          className="filterSelect"
        />
      </Field>

      <Field label="Etiquetas">
        <div className="mt-1 flex flex-wrap items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--bg-input)] px-1.5 py-1">
          {draft.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] text-[var(--accent)]"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                className="text-[var(--accent)]/60 hover:text-[var(--accent)]"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="enter para agregar"
            className="min-w-[80px] flex-1 bg-transparent text-[10px] text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none"
          />
        </div>
      </Field>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="self-end rounded border border-[var(--border-strong)] px-2 py-1.5 text-[10px] text-[var(--fg-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--fg-primary)]"
        >
          Limpiar filtros
        </button>
      )}

      <style>{`
        .filterSelect {
          margin-top: 0.25rem;
          width: 100%;
          min-width: 8rem;
          border-radius: 0.25rem;
          border: 1px solid #404040;
          background: #171717;
          padding: 0.375rem 0.5rem;
          font-size: 0.7rem;
          color: white;
        }
        .filterSelect:focus {
          border-color: #ffcd07;
          outline: none;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-[var(--fg-muted)]">{label}</div>
      {children}
    </div>
  );
}
