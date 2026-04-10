"use client";

import { useRef, useState } from "react";

import type { CommentWithAuthor } from "@/lib/queries/comments";
import type { MemberWithStats } from "@/lib/queries/members";
import { renderMarkdown } from "@/lib/markdown";

interface Props {
  taskId: number;
  members: MemberWithStats[];
  onCreated: (c: CommentWithAuthor) => void;
}

type Tab = "edit" | "preview";

interface ToolbarAction {
  label: string;
  title: string;
  apply: (sel: string) => { text: string; selectionOffset?: number };
}

const ACTIONS: ToolbarAction[] = [
  { label: "B", title: "Negrita (Cmd+B)", apply: (s) => ({ text: `**${s || "texto"}**` }) },
  { label: "I", title: "Italica (Cmd+I)", apply: (s) => ({ text: `*${s || "texto"}*` }) },
  { label: "S", title: "Tachado", apply: (s) => ({ text: `~~${s || "texto"}~~` }) },
  { label: "</>", title: "Codigo inline", apply: (s) => ({ text: "`" + (s || "code") + "`" }) },
  { label: "•", title: "Lista", apply: (s) => ({ text: `\n- ${s || "item"}\n- ` }) },
  { label: "1.", title: "Lista numerada", apply: (s) => ({ text: `\n1. ${s || "item"}\n2. ` }) },
  { label: "🔗", title: "Link", apply: (s) => ({ text: `[${s || "texto"}](https://)` }) },
  { label: "“”", title: "Cita", apply: (s) => ({ text: `\n> ${s || "cita"}\n` }) },
];

export default function CommentInput({ taskId, members, onCreated }: Props) {
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<Tab>("edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyToolbar(action: ToolbarAction) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = body.slice(start, end);
    const { text } = action.apply(sel);
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  }

  function insertMention(name: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    // Buscar el ultimo @ antes del cursor
    const before = body.slice(0, start);
    const lastAt = before.lastIndexOf("@");
    if (lastAt === -1) return;
    const afterReplace = body.slice(0, lastAt) + `@${name} ` + body.slice(start);
    setBody(afterReplace);
    setShowMentions(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = lastAt + name.length + 2;
      ta.selectionStart = ta.selectionEnd = cursor;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      applyToolbar(ACTIONS[0]);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      applyToolbar(ACTIONS[1]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setBody(v);
    // Detectar @mention activa: hay un @ a la izquierda del cursor sin espacio entre medio
    const cursor = e.target.selectionStart;
    const before = v.slice(0, cursor);
    const m = before.match(/@([a-zA-ZÀ-ÿ0-9_.-]*)$/);
    if (m) {
      setShowMentions(true);
      setMentionQuery(m[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  }

  async function submit() {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "Error al comentar");
      }
      const data = await r.json();
      onCreated(data.comment);
      setBody("");
      setTab("edit");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredMembers = members
    .filter((m) =>
      m.name.replace(/^@/, "").toLowerCase().includes(mentionQuery),
    )
    .slice(0, 6);

  return (
    <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/40">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-2 py-1">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`rounded px-2 py-1 text-[10px] uppercase tracking-wide ${
              tab === "edit" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-white"
            }`}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`rounded px-2 py-1 text-[10px] uppercase tracking-wide ${
              tab === "preview" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-white"
            }`}
          >
            Vista
          </button>
        </div>
        {tab === "edit" && (
          <div className="flex flex-wrap gap-1">
            {ACTIONS.map((a) => (
              <button
                key={a.label}
                type="button"
                title={a.title}
                onClick={() => applyToolbar(a)}
                className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white font-mono"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative p-3">
        {tab === "edit" ? (
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder="Comentar... markdown soportado. @nombre para mencionar. Cmd/Ctrl+Enter para enviar."
            className="w-full resize-none bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
          />
        ) : (
          <div
            className="prose prose-sm prose-invert min-h-[6rem] max-w-none text-sm text-neutral-200 [&_a]:text-[#ffcd07] [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_code]:bg-neutral-900 [&_code]:px-1 [&_code]:rounded"
            dangerouslySetInnerHTML={{
              __html: body.trim()
                ? renderMarkdown(body)
                : '<p class="text-neutral-600">vacio</p>',
            }}
          />
        )}

        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute left-3 top-full z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded-md border border-neutral-700 bg-neutral-950 shadow-lg">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => insertMention(m.name.replace(/^@/, ""))}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-800"
              >
                <span
                  className={
                    m.type === "agent" ? "text-emerald-300" : "text-neutral-100"
                  }
                >
                  {m.name}
                </span>
                <span className="ml-2 text-[10px] text-neutral-500">{m.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-800 px-3 py-2">
        <span className="text-[10px] text-neutral-600">{body.length}/5000</span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !body.trim()}
          className="rounded-md bg-[#ffcd07] px-3 py-1.5 text-xs font-semibold text-[#0a0a1a] hover:brightness-110 disabled:opacity-40"
        >
          {submitting ? "Enviando..." : "Comentar"}
        </button>
      </div>

      {error && <p className="px-3 pb-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
