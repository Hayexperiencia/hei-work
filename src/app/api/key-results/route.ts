import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import {
  recomputeObjectiveProgress,
  upsertKeyResult,
} from "@/lib/queries/objectives";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const objectiveId = Number(body.objective_id);
  if (!Number.isFinite(objectiveId)) return badRequest("objective_id required");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return badRequest("title required");
  const targetValue = Number(body.target_value);
  if (!Number.isFinite(targetValue)) return badRequest("target_value required");

  try {
    const kr = await upsertKeyResult({
      objectiveId,
      title,
      metricType: typeof body.metric_type === "string" ? body.metric_type : "number",
      currentValue: body.current_value != null ? Number(body.current_value) : 0,
      targetValue,
      startValue: body.start_value != null ? Number(body.start_value) : 0,
      unit: typeof body.unit === "string" ? body.unit : null,
      autoSource: typeof body.auto_source === "string" ? body.auto_source : null,
      autoSourceArgs:
        body.auto_source_args && typeof body.auto_source_args === "object"
          ? (body.auto_source_args as Record<string, unknown>)
          : {},
      position: body.position != null ? Number(body.position) : 0,
    });
    await recomputeObjectiveProgress(objectiveId);
    return NextResponse.json({ key_result: kr }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
