"use client";

import { useState } from "react";

import type { MemberWithStats } from "@/lib/queries/members";

type SafeMember = Omit<MemberWithStats, "password_hash">;

interface Props {
  initial: SafeMember[];
}

function initials(name: string) {
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const AGENT_TEMPLATES: Record<string, { role: string; soulHint: string; schedule: string; tools: string[] }> = {
  custom: { role: "custom", soulHint: "souls/custom.md", schedule: "0 9 * * 1", tools: [] },
  investigador: {
    role: "researcher",
    soulHint: "souls/investigador.md",
    schedule: "0 2 * * *",
    tools: ["web_search", "vault_read", "db_read"],
  },
  nurture: {
    role: "nurture",
    soulHint: "souls/nurture.md",
    schedule: "*/30 * * * *",
    tools: ["ghl_api", "harry_send"],
  },
  analytics: {
    role: "analytics",
    soulHint: "souls/analytics.md",
    schedule: "0 7 * * 1",
    tools: ["db_read", "harry_send"],
  },
};

export default function TeamClient({ initial }: Props) {
  const [members, setMembers] = useState<SafeMember[]>(initial);
  const [creatingHuman, setCreatingHuman] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [editing, setEditing] = useState<SafeMember | null>(null);

  const humans = members.filter((m) => m.type === "human");
  const agents = members.filter((m) => m.type === "agent");

  function upsert(m: SafeMember) {
    setMembers((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx === -1) return [...prev, m];
      const next = [...prev];
      next[idx] = m;
      return next;
    });
  }

  async function handleDelete(m: SafeMember) {
    if (!confirm(`Eliminar a "${m.name}"? (se desactiva, no se borra historico)`)) return;
    try {
      const r = await fetch(`/api/members/${m.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipo</h1>
          <p className="text-xs text-[var(--fg-muted)] mt-1">
            {humans.length} humano{humans.length === 1 ? "" : "s"} ·{" "}
            {agents.length} agente{agents.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCreatingHuman(true)}
            className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
          >
            + Persona
          </button>
          <button
            type="button"
            onClick={() => setCreatingAgent(true)}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110"
          >
            + Agente IA
          </button>
        </div>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-3">Humanos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {humans.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-hover)] text-sm font-semibold text-[var(--fg-primary)]">
                  {initials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--fg-primary)]">{m.name}</div>
                  <div className="text-xs text-[var(--fg-muted)]">{m.role ?? "—"}</div>
                </div>
                <MemberActions onEdit={() => setEditing(m)} onDelete={() => handleDelete(m)} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Stat label="Activas" value={m.active_tasks} />
                <Stat label="Hechas 30d" value={m.completed_tasks_30d} />
              </div>
              {m.email && (
                <div className="mt-2 truncate text-[10px] text-[var(--fg-muted)]">{m.email}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-3">Agentes IA</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((m) => {
            const cfg = m.config as Record<string, unknown>;
            const schedule = typeof cfg?.schedule === "string" ? cfg.schedule : null;
            const model = typeof cfg?.model === "string" ? cfg.model : null;
            return (
              <div
                key={m.id}
                className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/30 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--fg-primary)]">{m.name}</div>
                    <div className="text-xs text-emerald-400/80">{m.role ?? "agent"}</div>
                  </div>
                  <MemberActions onEdit={() => setEditing(m)} onDelete={() => handleDelete(m)} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Activas" value={m.active_tasks} />
                  <Stat label="Hechas 30d" value={m.completed_tasks_30d} />
                  <Stat label="Tokens 30d" value={m.tokens_used_30d.toLocaleString("es-CO")} />
                </div>
                {schedule && (
                  <div className="mt-2 font-mono text-[10px] text-[var(--fg-muted)]">
                    cron: {schedule}
                    {model && ` · ${model}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {creatingHuman && (
        <HumanModal
          onClose={() => setCreatingHuman(false)}
          onSaved={(m) => {
            upsert(m as SafeMember);
            setCreatingHuman(false);
          }}
        />
      )}
      {creatingAgent && (
        <AgentModal
          onClose={() => setCreatingAgent(false)}
          onSaved={(m) => {
            upsert(m as SafeMember);
            setCreatingAgent(false);
          }}
        />
      )}
      {editing && (
        <EditMemberModal
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            upsert(m as SafeMember);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[var(--fg-muted)]">{label}</div>
      <div className="text-[var(--fg-primary)] text-sm font-semibold">{value}</div>
    </div>
  );
}

function MemberActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onEdit}
        className="rounded p-1 text-[10px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
        title="Editar"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-[10px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-red-400"
        title="Eliminar"
      >
        🗑
      </button>
    </div>
  );
}

function HumanModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (m: SafeMember) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operator");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 8) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "human",
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error");
      }
      const data = await r.json();
      onSaved(data.member);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Nueva persona" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Input label="Nombre" value={name} onChange={setName} required />
        <Input label="Email" type="email" value={email} onChange={setEmail} required />
        <Input
          label="Password (min 8)"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <Input label="Rol" value={role} onChange={setRole} placeholder="admin, operator, advisor" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <ModalActions onClose={onClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

function AgentModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (m: SafeMember) => void;
}) {
  const [template, setTemplate] = useState<keyof typeof AGENT_TEMPLATES>("custom");
  const [name, setName] = useState("@");
  const [schedule, setSchedule] = useState("0 9 * * 1");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(t: keyof typeof AGENT_TEMPLATES) {
    setTemplate(t);
    const tpl = AGENT_TEMPLATES[t];
    setSchedule(tpl.schedule);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === "@") return;
    const tpl = AGENT_TEMPLATES[template];
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "agent",
          name: name.trim().startsWith("@") ? name.trim() : `@${name.trim()}`,
          role: tpl.role,
          schedule,
          model,
          config: {
            soul: tpl.soulHint,
            tools: tpl.tools,
            permissions: {
              can_create_tasks: true,
              can_close_tasks: false,
              can_notify_humans: true,
              can_call_external_apis: true,
            },
          },
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error");
      }
      const data = await r.json();
      onSaved(data.member);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Nuevo agente IA" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-xs text-[var(--fg-secondary)]">Plantilla</span>
          <select
            value={template}
            onChange={(e) => applyTemplate(e.target.value as keyof typeof AGENT_TEMPLATES)}
            className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
          >
            <option value="custom">Custom (vacio)</option>
            <option value="investigador">Investigador (research, vault, db)</option>
            <option value="nurture">Nurture (GHL, Harry)</option>
            <option value="analytics">Analytics (db, Harry)</option>
          </select>
        </label>
        <Input label="Nombre" value={name} onChange={setName} required />
        <Input
          label="Schedule (cron)"
          value={schedule}
          onChange={setSchedule}
          placeholder="ej: 0 2 * * *"
        />
        <label className="block">
          <span className="text-xs text-[var(--fg-secondary)]">Modelo</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
          >
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="claude-opus-4-6">Claude Opus 4.6</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          </select>
        </label>
        <p className="text-[10px] text-[var(--fg-muted)]">
          Nota: el executor de agentes (worker real) se construye en Sprint 3. Por ahora, crear el
          agente lo registra en /team y queda como placeholder.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <ModalActions onClose={onClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSaved,
}: {
  member: SafeMember;
  onClose: () => void;
  onSaved: (m: SafeMember) => void;
}) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? "");
  const [role, setRole] = useState(member.role ?? "");
  const [password, setPassword] = useState("");
  const cfg = member.config as Record<string, unknown>;
  const [schedule, setSchedule] = useState(typeof cfg?.schedule === "string" ? cfg.schedule : "");
  const [model, setModel] = useState(typeof cfg?.model === "string" ? cfg.model : "claude-sonnet-4-6");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name, role };
      if (member.type === "human") {
        body.email = email;
        if (password) body.password = password;
      } else {
        body.config = {
          ...(member.config as object),
          schedule,
          model,
        };
      }
      const r = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error");
      }
      const data = await r.json();
      onSaved(data.member);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`Editar ${member.type === "human" ? "persona" : "agente"}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Input label="Nombre" value={name} onChange={setName} required />
        <Input label="Rol" value={role} onChange={setRole} />
        {member.type === "human" ? (
          <>
            <Input label="Email" type="email" value={email} onChange={setEmail} required />
            <Input
              label="Nuevo password (opcional, min 8)"
              type="password"
              value={password}
              onChange={setPassword}
            />
          </>
        ) : (
          <>
            <Input label="Schedule (cron)" value={schedule} onChange={setSchedule} />
            <label className="block">
              <span className="text-xs text-[var(--fg-secondary)]">Modelo</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)]"
              >
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="claude-opus-4-6">Claude Opus 4.6</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              </select>
            </label>
          </>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <ModalActions onClose={onClose} submitting={submitting} />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border-base)] bg-[var(--bg-elevated)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--fg-secondary)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
      />
    </label>
  );
}

function ModalActions({ onClose, submitting }: { onClose: () => void; submitting: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
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
  );
}
