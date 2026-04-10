"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { TaskWithAssignee } from "@/lib/queries/tasks";
import type { MemberWithStats } from "@/lib/queries/members";
import type { Project, WorkflowStatus } from "@/lib/types";

import KanbanColumn from "./KanbanColumn";
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
  const [draggingTaskId, setDraggingTaskId] = React.useState<number | null>(null);
  const [draggingStatusId, setDraggingStatusId] = React.useState<number | null>(null);

  React.useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);
  React.useEffect(() => {
    setStatuses(initialStatuses);
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex-shrink-0 sticky top-0 z-20 border-b border-[var(--border-base)] bg-[var(--bg-elevated)] px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Board</h1>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              {tasks.length} tarea{tasks.length === 1 ? "" : "s"}
              {filters.project
                ? ` · ${projects.find((p) => p.id === filters.project)?.name ?? ""}`
                : " · todos los proyectos"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
            >
              + Proyecto
            </button>
            <button
              type="button"
              onClick={() => setShowNewStatus(true)}
              className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
            >
              + Estado
            </button>
            <button
              type="button"
              onClick={() => setShowNewTask(true)}
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110"
            >
              + Tarea
            </button>
          </div>
        </div>

        <FiltersBar
          projects={projects}
          members={members}
          filters={filters}
          onApply={applyFilters}
        />
      </header>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
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
