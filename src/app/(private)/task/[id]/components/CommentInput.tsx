"use client";

import { useState } from "react";

import type { CommentWithAuthor } from "@/lib/queries/comments";

interface Props {
  taskId: number;
  onCreated: (c: CommentWithAuthor) => void;
}

export default function CommentInput({ taskId, onCreated }: Props) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder="Comentar... markdown soportado. Cmd/Ctrl+Enter para enviar."
        className="w-full resize-none bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-neutral-600">
          {body.length}/5000
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !body.trim()}
          className="rounded-md bg-[#ffcd07] px-3 py-1.5 text-xs font-semibold text-[#0a0a1a] hover:brightness-110 disabled:opacity-40"
        >
          {submitting ? "Enviando..." : "Comentar"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
