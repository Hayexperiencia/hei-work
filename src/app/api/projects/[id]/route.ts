import { NextResponse } from "next/server";

import { badRequest, notFound, requireSession, serverError } from "@/lib/api-helpers";
import { query } from "@/lib/db";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return badRequest("invalid id");

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
  if ("description" in body) {
    push("description", body.description == null ? null : String(body.description));
  }
  if (typeof body.color === "string" && HEX_RE.test(body.color)) push("color", body.color);
  if (typeof body.status === "string") push("status", body.status);

  if (sets.length === 0) return badRequest("nothing to update");

  params.push(projectId);

  try {
    const r = await query<Project>(
      `UPDATE hei_work_projects SET ${sets.join(", ")} WHERE id=$${params.length}
       RETURNING id, workspace_id, name, description, color, status, linked_cotizador_id, created_at`,
      params,
    );
    if (r.rowCount === 0) return notFound("project_not_found");
    return NextResponse.json({ project: r.rows[0] });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return badRequest("invalid id");

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";

  try {
    const taskCount = await query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM hei_work_tasks WHERE project_id=$1`,
      [projectId],
    );
    const cnt = taskCount.rows[0]?.c ?? 0;
    if (cnt > 0 && !force) {
      return NextResponse.json(
        {
          error: "has_tasks",
          message: `el proyecto tiene ${cnt} tareas`,
          task_count: cnt,
        },
        { status: 409 },
      );
    }

    if (force && cnt > 0) {
      await query(`DELETE FROM hei_work_tasks WHERE project_id=$1`, [projectId]);
    }
    const r = await query(`DELETE FROM hei_work_projects WHERE id=$1`, [projectId]);
    if (r.rowCount === 0) return notFound("project_not_found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
