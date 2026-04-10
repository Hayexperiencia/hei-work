import { NextResponse } from "next/server";

import { requireSession, serverError } from "@/lib/api-helpers";
import {
  listNotifications,
  markRead,
  unreadCount,
} from "@/lib/queries/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  try {
    const [items, unread] = await Promise.all([
      listNotifications(guard.session.memberId, { unreadOnly, limit: 100 }),
      unreadCount(guard.session.memberId),
    ]);
    return NextResponse.json({ notifications: items, unread });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PATCH(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }

  const idsRaw = Array.isArray(body.ids) ? (body.ids as unknown[]) : null;
  const ids = idsRaw
    ? idsRaw.map((v) => Number(v)).filter((v) => Number.isFinite(v))
    : undefined;

  try {
    await markRead(guard.session.memberId, ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
