import { NextResponse } from "next/server";

import { badRequest, notFound, requireSession, serverError } from "@/lib/api-helpers";
import {
  deleteObjective,
  getObjective,
  updateObjective,
} from "@/lib/queries/objectives";
import type { ObjectiveStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const oid = Number(id);
  if (!Number.isFinite(oid)) return badRequest("invalid id");
  try {
    const obj = await getObjective(oid);
    if (!obj) return notFound("objective_not_found");
    return NextResponse.json({ objective: obj });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const oid = Number(id);
  if (!Number.isFinite(oid)) return badRequest("invalid id");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }
  const patch: Parameters<typeof updateObjective>[1] = {};
  if (typeof body.title === "string") patch.title = body.title;
  if ("description" in body) patch.description = (body.description ?? null) as string | null;
  if (typeof body.period === "string") patch.period = body.period;
  if (typeof body.status === "string") patch.status = body.status as ObjectiveStatus;
  if ("owner_id" in body) patch.ownerId = body.owner_id == null ? null : Number(body.owner_id);
  if (typeof body.color === "string") patch.color = body.color;
  try {
    const obj = await updateObjective(oid, patch);
    if (!obj) return notFound("objective_not_found");
    return NextResponse.json({ objective: obj });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const oid = Number(id);
  if (!Number.isFinite(oid)) return badRequest("invalid id");
  try {
    const ok = await deleteObjective(oid);
    if (!ok) return notFound("objective_not_found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
