import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { createTask, listTasks, type ListTasksOpts } from "@/lib/queries/tasks";
import { createNotification } from "@/lib/queries/notifications";
import type { TaskPriority } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_PRIORITY: TaskPriority[] = ["low", "medium", "high", "urgent"];

export async function GET(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const opts: ListTasksOpts = { workspaceId: 1 };

  const projectId = searchParams.get("project_id");
  if (projectId) opts.projectId = Number(projectId);

  const status = searchParams.get("status");
  if (status) opts.status = status;

  const assignee = searchParams.get("assignee_id");
  if (assignee === "unassigned") opts.assigneeId = "unassigned";
  else if (assignee) opts.assigneeId = Number(assignee);

  const tags = searchParams.get("tags");
  if (tags) opts.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);

  const dueFrom = searchParams.get("due_from");
  if (dueFrom) opts.dueFrom = dueFrom;
  const dueTo = searchParams.get("due_to");
  if (dueTo) opts.dueTo = dueTo;
  const createdFrom = searchParams.get("created_from");
  if (createdFrom) opts.createdFrom = createdFrom;
  const createdTo = searchParams.get("created_to");
  if (createdTo) opts.createdTo = createdTo;

  try {
    const tasks = await listTasks(opts);
    return NextResponse.json({ tasks });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return badRequest("title is required");

  const projectId = Number(body.project_id);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    return badRequest("project_id is required");
  }

  const priorityRaw = typeof body.priority === "string" ? body.priority : "medium";
  const priority = (VALID_PRIORITY as string[]).includes(priorityRaw)
    ? (priorityRaw as TaskPriority)
    : "medium";

  const assigneeId =
    body.assignee_id === null || body.assignee_id === undefined
      ? null
      : Number(body.assignee_id);

  try {
    const task = await createTask({
      projectId,
      title,
      description:
        typeof body.description === "string" ? body.description : undefined,
      priority,
      assigneeId: assigneeId !== null && Number.isFinite(assigneeId) ? assigneeId : null,
      dueDate:
        typeof body.due_date === "string" && body.due_date.length > 0
          ? body.due_date
          : null,
      labels: Array.isArray(body.labels)
        ? (body.labels.filter((l) => typeof l === "string") as string[])
        : [],
      taskType: typeof body.task_type === "string" ? body.task_type : "manual",
      createdBy: guard.session.memberId,
    });

    // Notificar al assignee si no es el creador
    if (
      task.assignee_id &&
      task.assignee_id !== guard.session.memberId
    ) {
      await createNotification({
        recipientId: task.assignee_id,
        actorId: guard.session.memberId,
        type: "assigned",
        taskId: task.id,
        payload: { title: task.title },
      });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
