import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { runMissionOnce } from "@/lib/agents/run-mission-once";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const missionId = Number(id);
  if (!Number.isFinite(missionId)) return badRequest("invalid id");
  try {
    const result = await runMissionOnce(missionId);
    return NextResponse.json({ result });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
