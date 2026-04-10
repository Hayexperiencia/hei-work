import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { createTask, listTasks } from "@/lib/queries/tasks";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_PRIORITY: TaskPriority[] = ["low", "medium", "high", "urgent"];
const VALID_STATUS: TaskStatus[] = ["backlog", "in_progress", "review", "done"];

export async function GET(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const status = searchParams.get("status");
  const assigneeId = searchParams.get("assignee_id");

  try {
    const tasks = await listTasks({
      workspaceId: 1,
      projectId: projectId ? Number(projectId) : undefined,
      status: status && VALID_STATUS.includes(status as TaskStatus)
        ? (status as TaskStatus)
        : undefined,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
    });
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
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
