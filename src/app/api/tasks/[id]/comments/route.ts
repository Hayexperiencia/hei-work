import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { createComment, listCommentsByTask } from "@/lib/queries/comments";
import { createNotification } from "@/lib/queries/notifications";
import { getTask } from "@/lib/queries/tasks";
import { parseMentions } from "@/lib/mentions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return badRequest("invalid task id");

  try {
    const comments = await listCommentsByTask(taskId);
    return NextResponse.json({ comments });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return badRequest("invalid task id");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return badRequest("body is required");
  if (text.length > 5000) return badRequest("body too long (max 5000)");

  try {
    // Parsear menciones antes de crear
    const mentions = await parseMentions(text, 1);
    const resolvedIds = Array.from(
      new Set(mentions.map((m) => m.memberId).filter((id): id is number => id !== null)),
    );

    const comment = await createComment({
      taskId,
      authorId: guard.session.memberId,
      body: text,
      metadata: {
        mentions: mentions.map((m) => ({ name: m.name, member_id: m.memberId })),
      },
    });

    // Notificaciones a mentioned humanos (no a agentes en este sprint)
    const task = await getTask(taskId);
    if (task) {
      // Mencionados
      for (const recipientId of resolvedIds) {
        await createNotification({
          recipientId,
          actorId: guard.session.memberId,
          type: "mention",
          taskId,
          commentId: comment.id,
          payload: { preview: text.slice(0, 200) },
        });
      }
      // Tambien al assignee si no es ni el autor ni ya fue mencionado
      if (
        task.assignee_id &&
        task.assignee_id !== guard.session.memberId &&
        !resolvedIds.includes(task.assignee_id)
      ) {
        await createNotification({
          recipientId: task.assignee_id,
          actorId: guard.session.memberId,
          type: "comment_on_my_task",
          taskId,
          commentId: comment.id,
          payload: { preview: text.slice(0, 200) },
        });
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
