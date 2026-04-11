import { NextResponse } from "next/server";

import { badRequest, notFound, requireSession, serverError } from "@/lib/api-helpers";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const ruleId = Number(id);
  if (!Number.isFinite(ruleId)) return badRequest("invalid id");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, v: unknown, cast?: string) => {
    params.push(v);
    sets.push(`${col} = $${params.length}${cast ? `::${cast}` : ""}`);
  };

  if (typeof body.name === "string") push("name", body.name.trim());
  if ("description" in body) push("description", body.description ?? null);
  if (typeof body.is_active === "boolean") push("is_active", body.is_active);
  if (body.trigger_config && typeof body.trigger_config === "object") {
    push("trigger_config", JSON.stringify(body.trigger_config), "jsonb");
  }
  if (body.action_config && typeof body.action_config === "object") {
    push("action_config", JSON.stringify(body.action_config), "jsonb");
  }
  if (typeof body.trigger_type === "string") push("trigger_type", body.trigger_type);
  if (typeof body.action_type === "string") push("action_type", body.action_type);

  if (sets.length === 0) return badRequest("nothing to update");
  params.push(ruleId);

  try {
    const r = await query(
      `UPDATE hei_work_automation_rules SET ${sets.join(", ")} WHERE id=$${params.length}
       RETURNING *`,
      params,
    );
    if (r.rowCount === 0) return notFound("rule_not_found");
    return NextResponse.json({ rule: r.rows[0] });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const ruleId = Number(id);
  if (!Number.isFinite(ruleId)) return badRequest("invalid id");

  try {
    const r = await query(`DELETE FROM hei_work_automation_rules WHERE id=$1`, [ruleId]);
    if (r.rowCount === 0) return notFound("rule_not_found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
