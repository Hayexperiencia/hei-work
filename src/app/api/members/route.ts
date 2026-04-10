import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { query } from "@/lib/db";
import { listMembers } from "@/lib/queries/members";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try {
    const members = await listMembers(1);
    const safe = members.map(({ password_hash: _ph, ...rest }) => rest);
    return NextResponse.json({ members: safe });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return badRequest("name is required");

  const type = body.type === "agent" ? "agent" : "human";
  const role = typeof body.role === "string" ? body.role.trim() : null;

  if (type === "human") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email) return badRequest("email is required for human members");
    if (!password || password.length < 8) return badRequest("password must be 8+ chars");

    try {
      const hash = await bcrypt.hash(password, 12);
      const r = await query<Member>(
        `INSERT INTO hei_work_members
           (workspace_id, name, email, type, role, password_hash, is_active)
         VALUES (1, $1, $2, 'human', $3, $4, true)
         RETURNING id, workspace_id, name, email, type, role, avatar_url,
                   config, password_hash, is_active, created_at`,
        [name, email, role, hash],
      );
      const { password_hash: _ph, ...safe } = r.rows[0];
      return NextResponse.json({ member: safe }, { status: 201 });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("uq_hei_work_members_email")) {
        return badRequest("email already exists");
      }
      return serverError(msg);
    }
  }

  // Agente
  const config = (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>;
  const schedule = typeof body.schedule === "string" ? body.schedule : "0 2 * * *";
  const model = typeof body.model === "string" ? body.model : "claude-sonnet-4-6";
  const finalConfig = {
    soul: typeof config.soul === "string" ? config.soul : `souls/${name.replace(/^@/, "").toLowerCase()}.md`,
    schedule,
    model,
    temperature: typeof config.temperature === "number" ? config.temperature : 0.3,
    budget_tokens_per_run: typeof config.budget_tokens_per_run === "number" ? config.budget_tokens_per_run : 50000,
    budget_tokens_per_month: typeof config.budget_tokens_per_month === "number" ? config.budget_tokens_per_month : 500000,
    tools: Array.isArray(config.tools) ? config.tools : [],
    permissions: typeof config.permissions === "object" ? config.permissions : {
      can_create_tasks: true,
      can_close_tasks: false,
      can_notify_humans: true,
      can_call_external_apis: true,
    },
  };

  try {
    const r = await query<Member>(
      `INSERT INTO hei_work_members
         (workspace_id, name, type, role, config, is_active)
       VALUES (1, $1, 'agent', $2, $3::jsonb, true)
       RETURNING id, workspace_id, name, email, type, role, avatar_url,
                 config, password_hash, is_active, created_at`,
      [name, role, JSON.stringify(finalConfig)],
    );
    const { password_hash: _ph, ...safe } = r.rows[0];
    return NextResponse.json({ member: safe }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
