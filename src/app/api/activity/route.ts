import { NextResponse } from "next/server";

import { requireSession, serverError } from "@/lib/api-helpers";
import { listRecentActivity } from "@/lib/queries/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);

  try {
    const events = await listRecentActivity(limit);
    return NextResponse.json({ events });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
