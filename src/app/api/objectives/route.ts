import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import {
  createObjective,
  listObjectives,
} from "@/lib/queries/objectives";
import type { ObjectiveStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ObjectiveStatus | null;
  try {
    const objectives = await listObjectives(1, status ?? undefined);
    return NextResponse.json({ objectives });
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
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return badRequest("title required");
  const period = typeof body.period === "string" ? body.period : "";
  if (!period) return badRequest("period required");
  try {
    const obj = await createObjective({
      title,
      description: typeof body.description === "string" ? body.description : null,
      period,
      ownerId: body.owner_id ? Number(body.owner_id) : null,
      color: typeof body.color === "string" ? body.color : undefined,
    });
    return NextResponse.json({ objective: obj }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
