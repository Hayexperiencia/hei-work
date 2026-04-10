import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { badRequest, notFound, requireSession, serverError } from "@/lib/api-helpers";
import { query } from "@/lib/db";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isFinite(memberId)) return badRequest("invalid id");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, v: unknown) => {
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  };

  if (typeof body.name === "string" && body.name.trim()) push("name", body.name.trim());
  if (typeof body.email === "string") push("email", body.email.trim().toLowerCase());
  if (typeof body.role === "string") push("role", body.role.trim());
  if (typeof body.is_active === "boolean") push("is_active", body.is_active);
  if (body.config && typeof body.config === "object") {
    push("config", JSON.stringify(body.config));
    // Special case: pg needs ::jsonb cast
    sets[sets.length - 1] = sets[sets.length - 1] + "::jsonb";
  }
  if (typeof body.password === "string" && body.password.length >= 8) {
    const hash = await bcrypt.hash(body.password, 12);
    push("password_hash", hash);
  }

  if (sets.length === 0) return badRequest("nothing to update");

  params.push(memberId);

  try {
    const r = await query<Member>(
      `UPDATE hei_work_members SET ${sets.join(", ")} WHERE id=$${params.length}
       RETURNING id, workspace_id, name, email, type, role, avatar_url,
                 config, password_hash, is_active, created_at`,
      params,
    );
    if (r.rowCount === 0) return notFound("member_not_found");
    const { password_hash: _ph, ...safe } = r.rows[0];
    return NextResponse.json({ member: safe });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("uq_hei_work_members_email")) {
      return badRequest("email already exists");
    }
    return serverError(msg);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isFinite(memberId)) return badRequest("invalid id");

  // No permitir eliminarte a ti mismo
  if (memberId === guard.session.memberId) {
    return badRequest("cannot delete yourself");
  }

  try {
    // Soft delete: is_active = false (para preservar historial de tareas)
    const r = await query(
      `UPDATE hei_work_members SET is_active=false WHERE id=$1`,
      [memberId],
    );
    if (r.rowCount === 0) return notFound("member_not_found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
