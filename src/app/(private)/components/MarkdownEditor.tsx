"use client";

import { useRef, useState } from "react";

import { renderMarkdown } from "@/lib/markdown";

interface Props {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
}

interface ToolbarAction {
  label: string;
  title: string;
  apply: (sel: string) => string;
}

const ACTIONS: ToolbarAction[] = [
  { label: "B", title: "Negrita (Cmd+B)", apply: (s) => `**${s || "texto"}**` },
  { label: "I", title: "Italica (Cmd+I)", apply: (s) => `*${s || "texto"}*` },
  { label: "S", title: "Tachado", apply: (s) => `~~${s || "texto"}~~` },
  { label: "</>", title: "Codigo", apply: (s) => "`" + (s || "code") + "`" },
  { label: "•", title: "Lista", apply: (s) => `\n- ${s || "item"}\n- ` },
  { label: "1.", title: "Lista numerada", apply: (s) => `\n1. ${s || "item"}\n2. ` },
  { label: "🔗", title: "Link", apply: (s) => `[${s || "texto"}](https://)` },
  { label: "\u201C\u201D", title: "Cita", apply: (s) => `\n> ${s || "cita"}\n` },
  { label: "H1", title: "Titulo", apply: (s) => `\n# ${s || "titulo"}\n` },
];

export default function MarkdownEditor({
  value,
  onChange,
  rows = 6,
  placeholder,
}: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const ref = useRef<HTMLTextAreaElement>(null);

  function applyAction(action: ToolbarAction) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const text = action.apply(sel);
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      applyAction(ACTIONS[0]);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      applyAction(ACTIONS[1]);
    }
  }

  return (
    <div className="mt-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)]">
      <div className="flex items-center justify-between border-b border-[var(--border-base)] px-2 py-1">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`rounded px-2 py-1 text-[10px] uppercase ${
              tab === "edit"
                ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
            }`}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`rounded px-2 py-1 text-[10px] uppercase ${
              tab === "preview"
                ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
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
                onClick={() => applyAction(a)}
                className="rounded px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] font-mono"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="p-2">
        {tab === "edit" ? (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={rows}
            placeholder={placeholder ?? "Markdown soportado"}
            className="w-full resize-y bg-transparent text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none"
          />
        ) : (
          <div
            className="prose-app min-h-[6rem] text-sm text-[var(--fg-primary)]"
            dangerouslySetInnerHTML={{
              __html: value.trim()
                ? renderMarkdown(value)
                : '<p class="text-[var(--fg-muted)]">vacio</p>',
            }}
          />
        )}
      </div>
    </div>
  );
}
