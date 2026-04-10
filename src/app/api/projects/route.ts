import { NextResponse } from "next/server";

import { requireSession, serverError } from "@/lib/api-helpers";
import { listProjects } from "@/lib/queries/members";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try {
    const projects = await listProjects(1);
    return NextResponse.json({ projects });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
