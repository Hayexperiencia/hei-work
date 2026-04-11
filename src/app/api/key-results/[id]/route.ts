import { NextResponse } from "next/server";

import { badRequest, notFound, requireSession, serverError } from "@/lib/api-helpers";
import { query } from "@/lib/db";
import {
  deleteKeyResult,
  recomputeObjectiveProgress,
  upsertKeyResult,
} from "@/lib/queries/objectives";
import { refreshKeyResult } from "@/lib/queries/okr-sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const krId = Number(id);
  if (!Number.isFinite(krId)) return badRequest("invalid id");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  try {
    // Load existing
    const r = await query<{ objective_id: number }>(
      `SELECT objective_id FROM hei_work_key_results WHERE id = $1`,
      [krId],
    );
    if (r.rowCount === 0) return notFound("key_result_not_found");

    const kr = await upsertKeyResult({
      id: krId,
      objectiveId: r.rows[0].objective_id,
      title: typeof body.title === "string" ? body.title : "",
      metricType: typeof body.metric_type === "string" ? body.metric_type : undefined,
      currentValue: body.current_value != null ? Number(body.current_value) : undefined,
      targetValue: body.target_value != null ? Number(body.target_value) : 0,
      startValue: body.start_value != null ? Number(body.start_value) : undefined,
      unit: typeof body.unit === "string" ? body.unit : null,
      autoSource: typeof body.auto_source === "string" ? body.auto_source : null,
      autoSourceArgs:
        body.auto_source_args && typeof body.auto_source_args === "object"
          ? (body.auto_source_args as Record<string, unknown>)
          : undefined,
      position: body.position != null ? Number(body.position) : undefined,
    });
    await recomputeObjectiveProgress(r.rows[0].objective_id);
    return NextResponse.json({ key_result: kr });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const krId = Number(id);
  if (!Number.isFinite(krId)) return badRequest("invalid id");
  try {
    const r = await query<{ objective_id: number }>(
      `SELECT objective_id FROM hei_work_key_results WHERE id = $1`,
      [krId],
    );
    const objId = r.rows[0]?.objective_id;
    const ok = await deleteKeyResult(krId);
    if (!ok) return notFound("key_result_not_found");
    if (objId) await recomputeObjectiveProgress(objId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(_req: Request, ctx: RouteContext) {
  // refresh single KR (read auto_source and update current_value)
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const krId = Number(id);
  if (!Number.isFinite(krId)) return badRequest("invalid id");
  try {
    const res = await refreshKeyResult(krId);
    return NextResponse.json({ result: res });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
