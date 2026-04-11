import { NextResponse } from "next/server";

import { badRequest, notFound, requireSession, serverError } from "@/lib/api-helpers";
import { deleteMission, getMission, updateMission } from "@/lib/queries/missions";
import type { MissionOutputStrategy } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_STRATEGIES: MissionOutputStrategy[] = [
  "comment",
  "new_task",
  "vault_note",
  "harry_send",
  "multi",
];

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const missionId = Number(id);
  if (!Number.isFinite(missionId)) return badRequest("invalid id");
  try {
    const mission = await getMission(missionId);
    if (!mission) return notFound("mission_not_found");
    return NextResponse.json({ mission });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const missionId = Number(id);
  if (!Number.isFinite(missionId)) return badRequest("invalid id");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const patch: Parameters<typeof updateMission>[1] = {};
  if (typeof body.name === "string") patch.name = body.name;
  if ("description" in body) patch.description = (body.description ?? null) as string | null;
  if (typeof body.instructions === "string") patch.instructions = body.instructions;
  if ("schedule" in body) patch.schedule = (body.schedule ?? null) as string | null;
  if (typeof body.output_strategy === "string") {
    if (!VALID_STRATEGIES.includes(body.output_strategy as MissionOutputStrategy)) {
      return badRequest("invalid output_strategy");
    }
    patch.outputStrategy = body.output_strategy as MissionOutputStrategy;
  }
  if (body.output_config && typeof body.output_config === "object") {
    patch.outputConfig = body.output_config as Record<string, unknown>;
  }
  if (typeof body.is_active === "boolean") patch.isActive = body.is_active;

  try {
    const mission = await updateMission(missionId, patch);
    if (!mission) return notFound("mission_not_found");
    return NextResponse.json({ mission });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const missionId = Number(id);
  if (!Number.isFinite(missionId)) return badRequest("invalid id");
  try {
    const ok = await deleteMission(missionId);
    if (!ok) return notFound("mission_not_found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
