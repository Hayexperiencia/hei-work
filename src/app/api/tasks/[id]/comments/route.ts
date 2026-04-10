import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { createComment, listCommentsByTask } from "@/lib/queries/comments";

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
    const comment = await createComment({
      taskId,
      authorId: guard.session.memberId,
      body: text,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
