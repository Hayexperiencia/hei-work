"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { TaskWithAssignee } from "@/lib/queries/tasks";
import type { MemberWithStats } from "@/lib/queries/members";
import type { Project, WorkflowStatus } from "@/lib/types";

import KanbanColumn from "./KanbanColumn";
import MobileTaskRow from "./MobileTaskRow";
import NewTaskModal from "./NewTaskModal";
import NewProjectModal from "./NewProjectModal";
import NewStatusModal from "./NewStatusModal";
import FiltersBar from "./FiltersBar";

export interface BoardFilters {
  project: number | null;
  assignee: string | null;
  tags: string[];
  dueFrom: string;
  dueTo: string;
  createdFrom: string;
  createdTo: string;
}

interface Props {
  initialTasks: TaskWithAssignee[];
  projects: Project[];
  members: MemberWithStats[];
  statuses: WorkflowStatus[];
  filters: BoardFilters;
}

export default function KanbanBoard({
  initialTasks,
  projects,
  members,
  statuses: initialStatuses,
  filters,
}: Props) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState<TaskWithAssignee[]>(initialTasks);
  const [statuses, setStatuses] = React.useState<WorkflowStatus[]>(initialStatuses);
  const [showNewTask, setShowNewTask] = React.useState(false);
  const [showNewProject, setShowNewProject] = React.useState(false);
  const [showNewStatus, setShowNewStatus] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [draggingTaskId, setDraggingTaskId] = React.useState<number | null>(null);
  const [draggingStatusId, setDraggingStatusId] = React.useState<number | null>(null);
  // En mobile mostramos solo UNA columna a la vez; el state es la key visible.
  const [mobileStatusKey, setMobileStatusKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);
  React.useEffect(() => {
    setStatuses(initialStatuses);
    // Si no hay status seleccionado o el seleccionado ya no existe, usa el primero
    setMobileStatusKey((prev) => {
      if (prev && initialStatuses.some((s) => s.key === prev)) return prev;
      return initialStatuses[0]?.key ?? null;
    });
  }, [initialStatuses]);

  const fetchTasks = React.useCallback(async () => {
    const usp = new URLSearchParams();
    if (filters.project) usp.set("project_id", String(filters.project));
    if (filters.assignee) usp.set("assignee_id", filters.assignee);
    if (filters.tags.length > 0) usp.set("tags", filters.tags.join(","));
    if (filters.dueFrom) usp.set("due_from", filters.dueFrom);
    if (filters.dueTo) usp.set("due_to", filters.dueTo);
    if (filters.createdFrom) usp.set("created_from", filters.createdFrom);
    if (filters.createdTo) usp.set("created_to", filters.createdTo);
    const r = await fetch(`/api/tasks?${usp.toString()}`, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    setTasks(data.tasks ?? []);
  }, [filters]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!draggingTaskId && !draggingStatusId) fetchTasks();
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchTasks, draggingTaskId, draggingStatusId]);

  const grouped = React.useMemo(() => {
    const map: Record<string, TaskWithAssignee[]> = {};
    for (const s of statuses) map[s.key] = [];
    for (const t of tasks) {
      if (!map[t.status]) map[t.status] = [];
      map[t.status].push(t);
    }
    return map;
  }, [tasks, statuses]);

  async function handleTaskDrop(targetStatus: string, taskId: number) {
    setDraggingTaskId(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)),
    );

    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!r.ok) throw new Error("update failed");
      fetchTasks();
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)),
      );
      alert("No se pudo mover la tarea: " + (err as Error).message);
    }
  }

  async function handleStatusReorder(draggedId: number, targetId: number) {
    setDraggingStatusId(null);
    if (draggedId === targetId) return;
    const draggedIdx = statuses.findIndex((s) => s.id === draggedId);
    const targetIdx = statuses.findIndex((s) => s.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const next = [...statuses];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(targetIdx, 0, moved);
    setStatuses(next);
    try {
      await fetch("/api/statuses/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: next.map((s) => s.id) }),
      });
    } catch (err) {
      alert("No se pudo reordenar: " + (err as Error).message);
      setStatuses(initialStatuses);
    }
  }

  async function handleStatusRename(id: number, label: string) {
    if (!label.trim()) return;
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label: label.trim() } : s)),
    );
    try {
      await fetch(`/api/statuses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  }

  async function handleStatusDelete(id: number) {
    const status = statuses.find((s) => s.id === id);
    if (!status) return;
    if (status.is_default) {
      alert("No puedes eliminar el estado por defecto.");
      return;
    }
    const taskCount = (grouped[status.key] ?? []).length;
    const fallback = statuses.find((s) => s.is_default)?.key ?? "backlog";
    if (
      !confirm(
        `Eliminar el estado "${status.label}"?${
          taskCount > 0
            ? `\n\n${taskCount} tareas en este estado se moveran a "${fallback}".`
            : ""
        }`,
      )
    )
      return;
    try {
      const r = await fetch(`/api/statuses/${id}?fallback=${fallback}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("delete failed");
      setStatuses((prev) => prev.filter((s) => s.id !== id));
      fetchTasks();
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  }

  function applyFilters(next: BoardFilters) {
    const usp = new URLSearchParams();
    if (next.project) usp.set("project", String(next.project));
    if (next.assignee) usp.set("assignee", next.assignee);
    if (next.tags.length > 0) usp.set("tags", next.tags.join(","));
    if (next.dueFrom) usp.set("due_from", next.dueFrom);
    if (next.dueTo) usp.set("due_to", next.dueTo);
    if (next.createdFrom) usp.set("created_from", next.createdFrom);
    if (next.createdTo) usp.set("created_to", next.createdTo);
    const qs = usp.toString();
    router.push(qs ? `/board?${qs}` : "/board");
  }

  function handleProjectCreated() {
    setShowNewProject(false);
    router.refresh();
  }
  function handleStatusCreated(s: WorkflowStatus) {
    setStatuses((prev) => [...prev, s].sort((a, b) => a.position - b.position));
    setShowNewStatus(false);
  }
  async function handleTaskCreated() {
    setShowNewTask(false);
    await fetchTasks();
  }

  const activeFilterCount =
    (filters.project ? 1 : 0) +
    (filters.assignee ? 1 : 0) +
    (filters.tags.length > 0 ? 1 : 0) +
    (filters.dueFrom ? 1 : 0) +
    (filters.dueTo ? 1 : 0) +
    (filters.createdFrom ? 1 : 0) +
    (filters.createdTo ? 1 : 0);

  const mobileStatus = statuses.find((s) => s.key === mobileStatusKey) ?? statuses[0];
  const mobileTasks = mobileStatus ? (grouped[mobileStatus.key] ?? []) : [];

  return (
    <div className="flex h-[calc(100vh-72px)] md:h-screen flex-col overflow-hidden">
      <header className="flex-shrink-0 sticky top-0 z-20 border-b border-[var(--border-base)] bg-[var(--bg-elevated)] px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold">Board</h1>
            <p className="text-xs text-[var(--fg-muted)] mt-0.5">
              {tasks.length} tarea{tasks.length === 1 ? "" : "s"}
              {filters.project
                ? ` · ${projects.find((p) => p.id === filters.project)?.name ?? ""}`
                : " · todos los proyectos"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="md:hidden rounded-md border border-[var(--border-strong)] px-2.5 py-2 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-[var(--accent-fg)]">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="hidden sm:block rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
            >
              + Proyecto
            </button>
            <button
              type="button"
              onClick={() => setShowNewStatus(true)}
              className="hidden sm:block rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
            >
              + Estado
            </button>
            <button
              type="button"
              onClick={() => setShowNewTask(true)}
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-xs sm:text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110"
            >
              + Tarea
            </button>
          </div>
        </div>

        {/* Filtros inline solo en desktop */}
        <div className="hidden md:block">
          <FiltersBar
            projects={projects}
            members={members}
            filters={filters}
            onApply={applyFilters}
          />
        </div>

        {/* Tabs de status solo en mobile */}
        <div className="md:hidden -mx-4 mt-3 overflow-x-auto no-scrollbar">
          <div className="flex gap-1 px-4 pb-1">
            {statuses.map((s) => {
              const active = s.key === mobileStatusKey;
              const cnt = (grouped[s.key] ?? []).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setMobileStatusKey(s.key)}
                  className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--fg-primary)]"
                      : "border-[var(--border-base)] text-[var(--fg-secondary)]"
                  }`}
                >
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: s.color }}
                  />
                  {s.label}
                  <span className="ml-1.5 text-[var(--fg-muted)]">({cnt})</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Desktop: kanban horizontal */}
      <div className="hidden md:block flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-4 p-4">
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={grouped[status.key] ?? []}
              isDragOver={false}
              draggingTaskId={draggingTaskId}
              draggingStatusId={draggingStatusId}
              onTaskDrop={handleTaskDrop}
              onTaskDragStart={(id) => setDraggingTaskId(id)}
              onTaskDragEnd={() => setDraggingTaskId(null)}
              onStatusDragStart={(id) => setDraggingStatusId(id)}
              onStatusDragEnd={() => setDraggingStatusId(null)}
              onStatusReorder={handleStatusReorder}
              onStatusRename={handleStatusRename}
              onStatusDelete={handleStatusDelete}
            />
          ))}
        </div>
      </div>

      {/* Mobile: una sola columna */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-3">
        {!mobileStatus ? (
          <div className="p-8 text-center text-xs text-[var(--fg-muted)]">
            Sin estados configurados
          </div>
        ) : mobileTasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--fg-muted)]">
            Sin tareas en {mobileStatus.label}
          </div>
        ) : (
          <div className="space-y-2">
            {mobileTasks.map((t) => (
              <MobileTaskRow
                key={t.id}
                task={t}
                statuses={statuses}
                currentStatusKey={mobileStatus.key}
                onMove={async (newStatus) => {
                  await handleTaskDrop(newStatus, t.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer de filtros (mobile) */}
      {showFilters && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFilters(false);
          }}
        >
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border-base)] bg-[var(--bg-elevated)] pb-safe">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-base)] bg-[var(--bg-elevated)] px-4 py-3">
              <h3 className="text-sm font-semibold">Filtros</h3>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="text-xl leading-none text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <FiltersBar
                projects={projects}
                members={members}
                filters={filters}
                onApply={(next) => {
                  applyFilters(next);
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="w-full border-t border-[var(--border-base)] py-3 text-sm text-[var(--fg-secondary)]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showNewTask && (
        <NewTaskModal
          projects={projects}
          members={members}
          defaultProjectId={filters.project}
          onClose={() => setShowNewTask(false)}
          onCreated={handleTaskCreated}
        />
      )}
      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={handleProjectCreated}
        />
      )}
      {showNewStatus && (
        <NewStatusModal
          onClose={() => setShowNewStatus(false)}
          onCreated={handleStatusCreated}
        />
      )}
    </div>
  );
}
