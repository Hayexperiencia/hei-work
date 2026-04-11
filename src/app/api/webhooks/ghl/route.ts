import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECRET = process.env.WEBHOOK_GHL_SECRET ?? "";

interface AutomationRule {
  id: number;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
}

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

  const logR = await query<{ id: number }>(
    `INSERT INTO hei_work_webhooks_log (source, event_type, payload, processed)
     VALUES ('ghl', $1, $2::jsonb, false)
     RETURNING id`,
    [eventType, JSON.stringify(payload)],
  );
  const logId = logR.rows[0].id;

  let createdTaskId: number | null = null;

  try {
    // Cargar reglas activas para webhook_ghl
    const rules = await query<AutomationRule>(
      `SELECT id, name, trigger_type, trigger_config, action_type, action_config, is_active
         FROM hei_work_automation_rules
        WHERE workspace_id = 1 AND trigger_type = 'webhook_ghl' AND is_active = true`,
    );

    for (const rule of rules.rows) {
      const cfg = rule.trigger_config;
      const wantedEvent = typeof cfg.event_type === "string" ? cfg.event_type : null;
      if (wantedEvent && wantedEvent !== eventType) continue;

      const requiredTag = typeof cfg.required_tag === "string" ? cfg.required_tag : null;
      if (requiredTag) {
        const tagsRaw = (payload.tags ?? []) as unknown;
        const tags = Array.isArray(tagsRaw) ? (tagsRaw as string[]) : [];
        if (!tags.includes(requiredTag)) continue;
      }

      // Action
      if (rule.action_type === "create_task") {
        const ac = rule.action_config;
        const assigneeName = typeof ac.assignee_name === "string" ? ac.assignee_name : null;
        const priority = typeof ac.priority === "string" ? ac.priority : "medium";
        const taskType = typeof ac.task_type === "string" ? ac.task_type : "manual";
        const titleTemplate =
          typeof ac.title_template === "string"
            ? ac.title_template
            : "Lead nuevo: {name}";
        const leadName =
          typeof payload.full_name === "string"
            ? payload.full_name
            : typeof payload.name === "string"
              ? payload.name
              : "sin nombre";
        const title = titleTemplate.replace("{name}", leadName);

        // Buscar assignee si aplica
        let assigneeId: number | null = null;
        if (assigneeName) {
          const a = await query<{ id: number }>(
            `SELECT id FROM hei_work_members
              WHERE workspace_id = 1 AND name = $1 AND is_active = true
              LIMIT 1`,
            [assigneeName],
          );
          assigneeId = a.rows[0]?.id ?? null;
        }

        // Buscar primer proyecto activo (default)
        const p = await query<{ id: number }>(
          `SELECT id FROM hei_work_projects
            WHERE workspace_id = 1 AND status = 'active'
            ORDER BY id LIMIT 1`,
        );
        const projectId = p.rows[0]?.id ?? 1;

        const tR = await query<{ id: number }>(
          `INSERT INTO hei_work_tasks
             (project_id, title, description, status, priority,
              assignee_id, task_type, metadata, sort_order)
           VALUES ($1, $2, $3, 'backlog', $4, $5, $6, $7::jsonb, 0)
           RETURNING id`,
          [
            projectId,
            title,
            `Lead generado desde webhook GHL.\n\n\`\`\`json\n${JSON.stringify(payload, null, 2).slice(0, 1500)}\n\`\`\``,
            priority,
            assigneeId,
            taskType,
            JSON.stringify({ webhook_log_id: logId, source: "ghl" }),
          ],
        );
        createdTaskId = tR.rows[0].id;

        // Notificar al assignee si es humano
        if (assigneeId) {
          await query(
            `INSERT INTO hei_work_notifications
               (recipient_id, actor_id, type, task_id, payload)
             VALUES ($1, NULL, 'assigned', $2, $3::jsonb)`,
            [assigneeId, createdTaskId, JSON.stringify({ title })],
          );
        }
      }

      await query(
        `UPDATE hei_work_automation_rules
            SET last_fired_at = NOW(),
                fire_count = fire_count + 1
          WHERE id = $1`,
        [rule.id],
      );
    }

    await query(
      `UPDATE hei_work_webhooks_log
          SET processed = true,
              task_created_id = $1
        WHERE id = $2`,
      [createdTaskId, logId],
    );

    return NextResponse.json({ ok: true, log_id: logId, task_created: createdTaskId });
  } catch (err) {
    await query(
      `UPDATE hei_work_webhooks_log SET error = $1 WHERE id = $2`,
      [(err as Error).message, logId],
    );
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
