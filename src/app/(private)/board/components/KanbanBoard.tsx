"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { TaskWithAssignee } from "@/lib/queries/tasks";
import type { MemberWithStats } from "@/lib/queries/members";
import type { Project, TaskStatus } from "@/lib/types";

import KanbanColumn from "./KanbanColumn";
import NewTaskModal from "./NewTaskModal";

interface Props {
  initialTasks: TaskWithAssignee[];
  projects: Project[];
  members: MemberWithStats[];
  selectedProjectId: number | null;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "in_progress", label: "En progreso" },
  { status: "review", label: "Revision" },
  { status: "done", label: "Hecho" },
];

export default function KanbanBoard({
  initialTasks,
  projects,
  members,
  selectedProjectId,
}: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithAssignee[]>(initialTasks);
  const [showModal, setShowModal] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Sync con server cuando cambia el filtro o monto
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Polling cada 10s para realtime "barato"
  const fetchTasks = useCallback(async () => {
    const url = selectedProjectId
      ? `/api/tasks?project_id=${selectedProjectId}`
      : "/api/tasks";
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    setTasks(data.tasks ?? []);
  }, [selectedProjectId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!draggingId) fetchTasks();
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchTasks, draggingId]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskWithAssignee[]> = {
      backlog: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const t of tasks) {
      map[t.status]?.push(t);
    }
    return map;
  }, [tasks]);

  async function handleDrop(targetStatus: TaskStatus, taskId: number) {
    setDraggingId(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Optimistic update
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
      // Refresca para tener orden y completed_at correctos
      fetchTasks();
    } catch (err) {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)),
      );
      alert("No se pudo mover la tarea: " + (err as Error).message);
    }
  }

  function handleProjectChange(projectId: number | null) {
    const url = projectId ? `/board?project=${projectId}` : "/board";
    router.push(url);
  }

  async function handleTaskCreated(_task: TaskWithAssignee) {
    setShowModal(false);
    await fetchTasks();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-col gap-3 border-b border-neutral-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Board</h1>
          <p className="text-xs text-neutral-500 mt-1">
            {tasks.length} tarea{tasks.length === 1 ? "" : "s"}
            {selectedProjectId
              ? ` · ${projects.find((p) => p.id === selectedProjectId)?.name ?? ""}`
              : " · todos los proyectos"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) =>
              handleProjectChange(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#ffcd07] focus:outline-none"
          >
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-md bg-[#ffcd07] px-3 py-2 text-sm font-semibold text-[#0a0a1a] hover:brightness-110"
          >
            + Tarea
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-4 p-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              tasks={grouped[col.status] ?? []}
              onDrop={handleDrop}
              onDragStart={(id) => setDraggingId(id)}
              onDragEnd={() => setDraggingId(null)}
              draggingId={draggingId}
            />
          ))}
        </div>
      </div>

      {showModal && (
        <NewTaskModal
          projects={projects}
          members={members}
          defaultProjectId={selectedProjectId}
          onClose={() => setShowModal(false)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
