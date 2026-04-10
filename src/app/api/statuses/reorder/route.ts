import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { withClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const ids = Array.isArray(body.ordered_ids)
    ? (body.ordered_ids as unknown[]).map((v) => Number(v)).filter((v) => Number.isFinite(v))
    : null;
  if (!ids || ids.length === 0) return badRequest("ordered_ids is required");

  try {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        for (let i = 0; i < ids.length; i++) {
          await c.query(
            `UPDATE hei_work_statuses SET position=$1 WHERE id=$2`,
            [i, ids[i]],
          );
        }
        await c.query("COMMIT");
      } catch (err) {
        await c.query("ROLLBACK");
        throw err;
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
