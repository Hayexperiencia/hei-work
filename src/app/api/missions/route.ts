import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { createMission, listMissions } from "@/lib/queries/missions";
import type { MissionOutputStrategy } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STRATEGIES: MissionOutputStrategy[] = [
  "comment",
  "new_task",
  "vault_note",
  "harry_send",
  "multi",
];

export async function GET(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(req.url);
  const agentIdRaw = searchParams.get("agent_id");
  const agentId = agentIdRaw ? Number(agentIdRaw) : undefined;
  try {
    const missions = await listMissions(agentId);
    return NextResponse.json({ missions });
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

  const agentId = Number(body.agent_id);
  if (!Number.isFinite(agentId)) return badRequest("agent_id required");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return badRequest("name required");
  const instructions = typeof body.instructions === "string" ? body.instructions : "";
  if (!instructions) return badRequest("instructions required");
  const strategy = typeof body.output_strategy === "string" ? body.output_strategy : "comment";
  if (!VALID_STRATEGIES.includes(strategy as MissionOutputStrategy)) {
    return badRequest("invalid output_strategy");
  }

  try {
    const mission = await createMission({
      agentId,
      name,
      description:
        typeof body.description === "string" ? body.description : null,
      instructions,
      schedule: typeof body.schedule === "string" ? body.schedule : null,
      outputStrategy: strategy as MissionOutputStrategy,
      outputConfig:
        body.output_config && typeof body.output_config === "object"
          ? (body.output_config as Record<string, unknown>)
          : {},
      isActive: body.is_active !== false,
    });
    return NextResponse.json({ mission }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
