"use client";

import { useCallback, useEffect, useState } from "react";

import type { CommentWithAuthor } from "@/lib/queries/comments";
import type { MemberWithStats } from "@/lib/queries/members";
import type { TaskWithAssignee } from "@/lib/queries/tasks";
import type { Project, TaskPriority, WorkflowStatus } from "@/lib/types";
import { renderMarkdown } from "@/lib/markdown";

import CommentThread from "./CommentThread";
import CommentInput from "./CommentInput";
import TagsInput from "./TagsInput";

type MobileTab = "detail" | "thread";

interface Props {
  initialTask: TaskWithAssignee;
  initialComments: CommentWithAuthor[];
  members: MemberWithStats[];
  projects: Project[];
  statuses: WorkflowStatus[];
}

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export default function TaskDetail({
  initialTask,
  initialComments,
  members,
  projects,
  statuses,
}: Props) {
  const [task, setTask] = useState(initialTask);
  const [comments, setComments] = useState(initialComments);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(task.description ?? "");
  const [descMode, setDescMode] = useState<"edit" | "preview">("preview");
  const [savingDesc, setSavingDesc] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("detail");

  const fetchComments = useCallback(async () => {
    const r = await fetch(`/api/tasks/${task.id}/comments`, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    setComments(data.comments ?? []);
  }, [task.id]);

  useEffect(() => {
    const i = setInterval(fetchComments, 10_000);
    return () => clearInterval(i);
  }, [fetchComments]);

  async function patchTask(patch: Record<string, unknown>) {
    const r = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data.task) setTask(data.task);
    return data.task as TaskWithAssignee;
  }

  async function saveTitle() {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== task.title) {
      await patchTask({ title: titleDraft.trim() });
    } else {
      setTitleDraft(task.title);
    }
  }

  async function saveDesc() {
    if (descDraft === (task.description ?? "")) {
      setDescMode("preview");
      return;
    }
    setSavingDesc(true);
    await patchTask({ description: descDraft });
    setSavingDesc(false);
    setDescMode("preview");
  }

  async function handleStatusChange(status: string) {
    await patchTask({ status });
  }
  async function handlePriorityChange(priority: TaskPriority) {
    await patchTask({ priority });
  }
  async function handleAssigneeChange(value: string) {
    await patchTask({ assignee_id: value === "" ? null : Number(value) });
  }
  async function handleProjectChange(value: string) {
    if (!value) return;
    await patchTask({ project_id: Number(value) });
  }
  async function handleDueDateChange(value: string) {
    await patchTask({ due_date: value || null });
  }
  async function handleTagsChange(tags: string[]) {
    await patchTask({ labels: tags });
  }

  async function handleCommentCreated(c: CommentWithAuthor) {
    setComments((prev) => [...prev, c]);
  }

  const dueDateValue = task.due_date ? task.due_date.slice(0, 10) : "";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
      {/* Mobile tabs */}
      <div className="lg:hidden mb-4 flex rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-1">
        <button
          type="button"
          onClick={() => setMobileTab("detail")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
            mobileTab === "detail"
              ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]"
              : "text-[var(--fg-muted)]"
          }`}
        >
          Detalle
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("thread")}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
            mobileTab === "thread"
              ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]"
              : "text-[var(--fg-muted)]"
          }`}
        >
          Hilo {comments.length > 0 && `(${comments.length})`}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Columna principal — fields + descripcion (3/4) */}
        <div
          className={`lg:col-span-3 space-y-6 ${
            mobileTab === "detail" ? "block" : "hidden"
          } lg:block`}
        >
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-[var(--fg-muted)]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: task.project_color }}
              />
              {task.project_name} · #{task.id}
            </div>

            {editingTitle ? (
              <input
                value={titleDraft}
                autoFocus
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    setTitleDraft(task.title);
                    setEditingTitle(false);
                  }
                }}
                className="w-full bg-transparent text-xl sm:text-2xl font-semibold text-[var(--fg-primary)] border-b border-[var(--accent)] focus:outline-none"
              />
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                className="cursor-text text-xl sm:text-2xl font-semibold text-[var(--fg-primary)] hover:bg-[var(--bg-card)] rounded px-1 -mx-1 break-words"
                title="Click para editar"
              >
                {task.title}
              </h1>
            )}
          </div>

          {/* Grid de metadata */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Proyecto">
              <select
                value={task.project_id}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="select"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Estado">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="select"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prioridad">
              <select
                value={task.priority}
                onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                className="select"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Asignado">
              <select
                value={task.assignee_id ?? ""}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="select"
              >
                <option value="">Sin asignar</option>
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

            <Field label="Fecha limite">
              <input
                type="date"
                value={dueDateValue}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="select"
              />
            </Field>

            <Field label="Creada">
              <div className="mt-1 text-xs text-[var(--fg-secondary)]">
                {new Date(task.created_at).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </Field>

            <div className="col-span-2 sm:col-span-3 lg:col-span-2">
              <Field label="Etiquetas">
                <TagsInput value={task.labels ?? []} onChange={handleTagsChange} />
              </Field>
            </div>
          </div>

          {/* Descripcion */}
          <section>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
                Descripcion {savingDesc && <span className="text-[var(--fg-muted)]">guardando...</span>}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDescMode("edit")}
                  className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                    descMode === "edit"
                      ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                  }`}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDescMode("preview")}
                  className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                    descMode === "preview"
                      ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                  }`}
                >
                  Vista
                </button>
              </div>
            </div>
            {descMode === "edit" ? (
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={saveDesc}
                rows={8}
                placeholder="Markdown soportado. Click fuera para guardar."
                className="w-full rounded border border-[var(--border-base)] bg-[var(--bg-input)] p-3 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
            ) : (
              <div
                onClick={() => setDescMode("edit")}
                className="prose prose-sm prose-invert min-h-[5rem] cursor-text rounded border border-[var(--border-base)] bg-[var(--bg-card)] p-3 text-sm text-[var(--fg-primary)] [&_a]:text-[var(--accent)] [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_code]:bg-[var(--bg-input)] [&_code]:px-1 [&_code]:rounded"
                dangerouslySetInnerHTML={{
                  __html: descDraft.trim()
                    ? renderMarkdown(descDraft)
                    : '<p class="text-[var(--fg-muted)]">Sin descripcion. Click para escribir.</p>',
                }}
              />
            )}
          </section>
        </div>

        {/* Columna comentarios (1/4) */}
        <aside
          className={`lg:col-span-1 ${
            mobileTab === "thread" ? "block" : "hidden"
          } lg:block`}
        >
          <div className="lg:sticky lg:top-4 space-y-3">
            <div className="hidden lg:block text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
              Hilo · {comments.length} comentario{comments.length === 1 ? "" : "s"}
            </div>
            <CommentThread comments={comments} />
            <CommentInput
              taskId={task.id}
              members={members}
              onCreated={handleCommentCreated}
            />
          </div>
        </aside>
      </div>

      <style>{`
        .select {
          margin-top: 0.25rem;
          width: 100%;
          border-radius: 0.25rem;
          border: 1px solid #262626;
          background: #171717;
          padding: 0.375rem 0.5rem;
          font-size: 0.75rem;
          color: white;
        }
        .select:focus {
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
      <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">{label}</div>
      {children}
    </div>
  );
}
