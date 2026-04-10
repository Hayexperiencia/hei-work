import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { createStatus, listStatuses } from "@/lib/queries/statuses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ statuses: await listStatuses(1) });
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

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return badRequest("label is required");
  if (label.length > 100) return badRequest("label too long");

  const color = typeof body.color === "string" && HEX_RE.test(body.color)
    ? body.color
    : "#a0a0a0";

  try {
    const status = await createStatus({
      label,
      color,
      isTerminal: Boolean(body.is_terminal),
    });
    return NextResponse.json({ status }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
