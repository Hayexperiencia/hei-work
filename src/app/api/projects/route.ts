import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { query } from "@/lib/db";
import { listProjects } from "@/lib/queries/members";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try {
    const projects = await listProjects(1);
    return NextResponse.json({ projects });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function POST(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid json body");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return badRequest("name is required");
  if (name.length > 200) return badRequest("name too long");

  const colorRaw = typeof body.color === "string" ? body.color : "#ffcd07";
  const color = HEX_RE.test(colorRaw) ? colorRaw : "#ffcd07";

  const description =
    typeof body.description === "string" ? body.description.trim() : null;

  try {
    const r = await query<Project>(
      `INSERT INTO hei_work_projects (workspace_id, name, description, color, status)
       VALUES (1, $1, $2, $3, 'active')
       RETURNING id, workspace_id, name, description, color, status,
                 linked_cotizador_id, created_at`,
      [name, description, color],
    );
    return NextResponse.json({ project: r.rows[0] }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
