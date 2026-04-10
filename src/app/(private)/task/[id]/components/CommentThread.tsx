"use client";

import { useState } from "react";

import type { CommentWithAuthor } from "@/lib/queries/comments";
import { renderMarkdown } from "@/lib/markdown";

interface Props {
  comments: CommentWithAuthor[];
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

export default function CommentThread({ comments }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (comments.length === 0) {
    return (
      <div className="rounded border border-dashed border-[var(--border-base)] px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
        Sin comentarios aun. Escribe el primero.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((c) => {
        const isAgent = c.author_type === "agent";
        const hasMeta = isAgent && c.metadata && Object.keys(c.metadata).length > 0;
        const showMeta = expanded.has(c.id);

        return (
          <div
            key={c.id}
            className={`rounded-lg border p-3 ${
              isAgent
                ? "border-emerald-500/30 bg-emerald-950/20"
                : "border-[var(--border-base)] bg-[var(--bg-card)]"
            }`}
          >
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`font-semibold ${
                  isAgent ? "text-emerald-300" : "text-[var(--fg-primary)]"
                }`}
              >
                {c.author_name ?? "anonimo"}
              </span>
              {isAgent && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
                  agente
                </span>
              )}
              <span className="text-[var(--fg-muted)]">{timeAgo(c.created_at)}</span>
            </div>
            <div
              className="prose prose-sm prose-invert mt-2 max-w-none text-sm text-[var(--fg-primary)] [&_a]:text-[var(--accent)] [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_code]:bg-[var(--bg-input)] [&_code]:px-1 [&_code]:rounded"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }}
            />
            {hasMeta && (
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="mt-2 text-[10px] uppercase tracking-wide text-emerald-400 hover:underline"
              >
                {showMeta ? "ocultar" : "ver"} metadata
              </button>
            )}
            {hasMeta && showMeta && (
              <pre className="mt-2 overflow-x-auto rounded bg-[var(--bg-elevated)] p-2 text-[10px] text-[var(--fg-secondary)]">
                {JSON.stringify(c.metadata, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
