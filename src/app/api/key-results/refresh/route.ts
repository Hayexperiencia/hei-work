import { NextResponse } from "next/server";

import { requireSession, serverError } from "@/lib/api-helpers";
import { refreshAllKeyResults } from "@/lib/queries/okr-sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try {
    const result = await refreshAllKeyResults();
    return NextResponse.json({ result });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
