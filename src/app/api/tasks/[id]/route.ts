import { NextResponse } from "next/server";

import { badRequest, notFound, requireSession, serverError } from "@/lib/api-helpers";
import { getTask, reorderTasks, updateTask } from "@/lib/queries/tasks";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUS: TaskStatus[] = ["backlog", "in_progress", "review", "done"];
const VALID_PRIORITY: TaskPriority[] = ["low", "medium", "high", "urgent"];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return badRequest("invalid id");

  try {
    const task = await getTask(taskId);
    if (!task) return notFound("task_not_found");
    return NextResponse.json({ task });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return badRequest("invalid id");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  // Caso especial: reordenar columna entera
  if (body.action === "reorder" && Array.isArray(body.ordered_ids)) {
    const targetStatus = String(body.status ?? "");
    if (!VALID_STATUS.includes(targetStatus as TaskStatus)) {
      return badRequest("invalid status");
    }
    const ids = (body.ordered_ids as unknown[])
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));
    try {
      await reorderTasks(taskId, targetStatus as TaskStatus, ids);
      const task = await getTask(taskId);
      return NextResponse.json({ task });
    } catch (err) {
      return serverError((err as Error).message);
    }
  }

  // Update normal de campos
  const patch: Parameters<typeof updateTask>[1] = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if ("description" in body) {
    patch.description = body.description == null ? null : String(body.description);
  }
  if (typeof body.status === "string") {
    if (!VALID_STATUS.includes(body.status as TaskStatus)) {
      return badRequest("invalid status");
    }
    patch.status = body.status as TaskStatus;
  }
  if (typeof body.priority === "string") {
    if (!VALID_PRIORITY.includes(body.priority as TaskPriority)) {
      return badRequest("invalid priority");
    }
    patch.priority = body.priority as TaskPriority;
  }
  if ("assignee_id" in body) {
    const v = body.assignee_id;
    patch.assigneeId = v == null ? null : Number(v);
  }
  if ("due_date" in body) {
    const v = body.due_date;
    patch.dueDate = v == null || v === "" ? null : String(v);
  }
  if (Array.isArray(body.labels)) {
    patch.labels = (body.labels as unknown[]).filter(
      (l) => typeof l === "string",
    ) as string[];
  }

  try {
    const updated = await updateTask(taskId, patch);
    if (!updated) return notFound("task_not_found");
    return NextResponse.json({ task: updated });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return badRequest("invalid id");

  // Soft delete: marcamos como done con label 'archived'
  try {
    const updated = await updateTask(taskId, {
      status: "done",
      labels: ["archived"],
    });
    if (!updated) return notFound("task_not_found");
    return NextResponse.json({ task: updated });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
