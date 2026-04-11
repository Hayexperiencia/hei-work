import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AutomationRule {
  id: number;
  workspace_id: number;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  last_fired_at: string | null;
  fire_count: number;
  created_at: string;
}

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  try {
    const r = await query<AutomationRule>(
      `SELECT * FROM hei_work_automation_rules
        WHERE workspace_id = 1
        ORDER BY id`,
    );
    return NextResponse.json({ rules: r.rows });
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
  const trigger_type = typeof body.trigger_type === "string" ? body.trigger_type : "";
  const action_type = typeof body.action_type === "string" ? body.action_type : "";
  if (!name || !trigger_type || !action_type) {
    return badRequest("name, trigger_type, action_type required");
  }

  try {
    const r = await query<AutomationRule>(
      `INSERT INTO hei_work_automation_rules
         (workspace_id, name, description, trigger_type, trigger_config,
          action_type, action_config, is_active)
       VALUES (1, $1, $2, $3, $4::jsonb, $5, $6::jsonb, $7)
       RETURNING *`,
      [
        name,
        typeof body.description === "string" ? body.description : null,
        trigger_type,
        JSON.stringify(body.trigger_config ?? {}),
        action_type,
        JSON.stringify(body.action_config ?? {}),
        body.is_active !== false,
      ],
    );
    return NextResponse.json({ rule: r.rows[0] }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
