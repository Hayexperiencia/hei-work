import { NextResponse } from "next/server";

import { requireSession, serverError } from "@/lib/api-helpers";
import { listMembers } from "@/lib/queries/members";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try {
    const members = await listMembers(1);
    // No exponer password_hash
    const safe = members.map(({ password_hash: _ph, ...rest }) => rest);
    return NextResponse.json({ members: safe });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
