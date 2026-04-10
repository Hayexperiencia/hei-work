import { NextResponse } from "next/server";

import { badRequest, notFound, requireSession, serverError } from "@/lib/api-helpers";
import { deleteStatus, updateStatus } from "@/lib/queries/statuses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isFinite(sid)) return badRequest("invalid id");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const patch: Parameters<typeof updateStatus>[1] = {};
  if (typeof body.label === "string" && body.label.trim()) {
    patch.label = body.label.trim();
  }
  if (typeof body.color === "string" && HEX_RE.test(body.color)) {
    patch.color = body.color;
  }
  if (typeof body.position === "number") patch.position = body.position;
  if (typeof body.is_terminal === "boolean") patch.isTerminal = body.is_terminal;

  try {
    const updated = await updateStatus(sid, patch);
    if (!updated) return notFound("status_not_found");
    return NextResponse.json({ status: updated });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isFinite(sid)) return badRequest("invalid id");

  const { searchParams } = new URL(req.url);
  const fallback = searchParams.get("fallback") ?? "backlog";

  try {
    const ok = await deleteStatus(sid, fallback);
    if (!ok) return badRequest("cannot delete (default or not found)");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
