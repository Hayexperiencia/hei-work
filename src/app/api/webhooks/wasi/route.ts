import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECRET = process.env.WEBHOOK_WASI_SECRET ?? "";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const provided = searchParams.get("secret");
  if (!SECRET || provided !== SECRET) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType =
    typeof payload.type === "string"
      ? payload.type
      : typeof payload.event === "string"
        ? payload.event
        : "unknown";

  await query(
    `INSERT INTO hei_work_webhooks_log (source, event_type, payload, processed)
     VALUES ('wasi', $1, $2::jsonb, true)`,
    [eventType, JSON.stringify(payload)],
  );

  // Sprint 3 minimal: solo loguea. Reglas de Wasi se anaden en Sprint 4.
  return NextResponse.json({ ok: true });
}
