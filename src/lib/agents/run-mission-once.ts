// Version web del mission executor — duplicacion consciente de src/worker/mission-executor.ts
// igual que run-once.ts vs executor.ts

import * as fs from "fs/promises";
import * as path from "path";

import { query } from "@/lib/db";
import type { AgentMission, Member } from "@/lib/types";

import { TOOL_DEFS, runToolWeb, type ToolContextWeb } from "./tools";

const MAX_TOOL_LOOPS = 8;
const DEFAULT_RUN_BUDGET = 50_000;
const DEFAULT_MONTH_BUDGET = 500_000;

const VAULT_ROOT = process.env.VAULT_PATH ?? "/vault";
const HARRY_URL = process.env.HARRY_URL ?? "http://localhost:18789";
const HARRY_TOKEN = process.env.HARRY_TOKEN ?? "";

export interface MissionRunResult {
  ok: boolean;
  status: "done" | "failed" | "budget_exceeded";
  tokens: number;
  action_id: number | null;
  mission_id: number;
  message: string;
}

export async function runMissionOnce(missionId: number): Promise<MissionRunResult> {
  const start = Date.now();

  const mR = await query<AgentMission>(
    `SELECT * FROM hei_work_agent_missions WHERE id = $1`,
    [missionId],
  );
  const mission = mR.rows[0];
  if (!mission) {
    return {
      ok: false,
      status: "failed",
      tokens: 0,
      action_id: null,
      mission_id: missionId,
      message: "mision no encontrada",
    };
  }

  const aR = await query<Member>(
    `SELECT * FROM hei_work_members WHERE id = $1 AND type='agent' AND is_active=true`,
    [mission.agent_id],
  );
  const agent = aR.rows[0];
  if (!agent) {
    return {
      ok: false,
      status: "failed",
      tokens: 0,
      action_id: null,
      mission_id: missionId,
      message: "agente no encontrado o inactivo",
    };
  }

  const cfg = (agent.config ?? {}) as Record<string, unknown>;
  const monthLimit = (cfg.budget_tokens_per_month as number) ?? DEFAULT_MONTH_BUDGET;
  const runLimit = (cfg.budget_tokens_per_run as number) ?? DEFAULT_RUN_BUDGET;

  const usedR = await query<{ used: number }>(
    `SELECT COALESCE(SUM(tokens_used),0)::int AS used
       FROM hei_work_agent_actions
      WHERE agent_id = $1 AND created_at >= date_trunc('month', NOW())`,
    [agent.id],
  );
  if ((usedR.rows[0]?.used ?? 0) >= monthLimit) {
    return {
      ok: false,
      status: "budget_exceeded",
      tokens: 0,
      action_id: null,
      mission_id: missionId,
      message: "budget mensual agotado",
    };
  }

  const actR = await query<{ id: number }>(
    `INSERT INTO hei_work_agent_actions
       (agent_id, task_id, action_type, status, input)
     VALUES ($1, NULL, 'mission', 'running', $2::jsonb)
     RETURNING id`,
    [
      agent.id,
      JSON.stringify({
        mission_id: mission.id,
        mission_name: mission.name,
        source: "run_now",
      }),
    ],
  );
  const actionId = actR.rows[0].id;

  try {
    const tools = (cfg.tools as string[]) ?? [];
    const toolDefs = tools
      .map((n) => TOOL_DEFS[n])
      .filter((d): d is NonNullable<typeof d> => Boolean(d));

    const soul =
      typeof cfg.soul_text === "string" && cfg.soul_text
        ? cfg.soul_text
        : `(SOUL no configurado para ${agent.name})`;

    const systemMsg = `Estas operando como el agente ${agent.name} dentro de HEI Work.
Cumples la identidad y los limites definidos en tu SOUL.

# Tu identidad (SOUL)
${soul}

# Modo de operacion
Estas ejecutando una MISION recurrente (invocada manualmente desde UI).
Tu output final se procesara segun la estrategia configurada.

REGLAS:
- Usa markdown con TL;DR arriba, detalles abajo.
- Cita fuentes (tool calls).
- Si falta data, dilo explicitamente.
- Solo puedes usar las tools listadas en tu config.`;

    const userMsg = `# Mision: ${mission.name}

${mission.description ? `${mission.description}\n\n` : ""}## Instrucciones
${mission.instructions}

Ejecuta ahora.`;

    interface MsgShape {
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      tool_call_id?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    }

    const messages: MsgShape[] = [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ];

    const cliproxyUrl = (process.env.CLIPROXY_URL ?? "http://localhost:8317").replace(/\/$/, "");
    const cliproxyKey = process.env.CLIPROXY_API_KEY ?? "";

    let totalTokens = 0;
    const toolCallsLog: Array<{ name: string; ok: boolean; output: string }> = [];
    let finalContent = "";

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const body = {
        model: (cfg.model as string) ?? "claude-sonnet-4-6",
        messages,
        temperature: (cfg.temperature as number) ?? 0.3,
        max_tokens: 4000,
        ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
      };
      const r = await fetch(`${cliproxyUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cliproxyKey ? { Authorization: `Bearer ${cliproxyKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`LLM HTTP ${r.status}: ${text.slice(0, 300)}`);
      }
      const data = (await r.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
          };
        }>;
        usage?: { total_tokens?: number };
      };
      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? "";
      const toolCalls = choice?.message?.tool_calls ?? [];
      totalTokens += data.usage?.total_tokens ?? 0;

      if (totalTokens > runLimit) {
        await query(
          `UPDATE hei_work_agent_actions
              SET status='budget_exceeded', tokens_used=$1, completed_at=NOW(),
                  duration_ms=$2
            WHERE id=$3`,
          [totalTokens, Date.now() - start, actionId],
        );
        return {
          ok: false,
          status: "budget_exceeded",
          tokens: totalTokens,
          action_id: actionId,
          mission_id: mission.id,
          message: "budget por run agotado",
        };
      }

      if (toolCalls.length === 0) {
        finalContent = content;
        break;
      }

      messages.push({
        role: "assistant",
        content: content || "",
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const ctxTool: ToolContextWeb = { agentId: agent.id, enabledTools: tools };
        const result = await runToolWeb(ctxTool, tc.function.name, tc.function.arguments);
        toolCallsLog.push({
          name: tc.function.name,
          ok: result.ok,
          output: result.output.slice(0, 500),
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result.output.slice(0, 8000),
        });
      }
    }

    if (!finalContent) {
      finalContent = "(mision sin respuesta final tras agotar tool loops)";
    }

    // Aplicar output strategy
    await applyOutputStrategyWeb(mission, agent, finalContent, {
      tokens: totalTokens,
      actionId,
      toolCalls: toolCallsLog,
    });

    await query(
      `UPDATE hei_work_agent_actions
          SET status='done', tokens_used=$1, duration_ms=$2, output=$3::jsonb,
              completed_at=NOW()
        WHERE id=$4`,
      [
        totalTokens,
        Date.now() - start,
        JSON.stringify({
          mission_id: mission.id,
          output_strategy: mission.output_strategy,
          final_len: finalContent.length,
        }),
        actionId,
      ],
    );
    await query(
      `UPDATE hei_work_agent_missions
          SET last_run_at=NOW(), last_run_status='done',
              last_run_action_id=$1, fire_count=fire_count+1
        WHERE id=$2`,
      [actionId, mission.id],
    );

    return {
      ok: true,
      status: "done",
      tokens: totalTokens,
      action_id: actionId,
      mission_id: mission.id,
      message: "mision completada",
    };
  } catch (err) {
    const message = (err as Error).message;
    await query(
      `UPDATE hei_work_agent_actions
          SET status='failed', error=$1, duration_ms=$2, completed_at=NOW()
        WHERE id=$3`,
      [message, Date.now() - start, actionId],
    );
    await query(
      `UPDATE hei_work_agent_missions
          SET last_run_at=NOW(), last_run_status='failed', last_run_action_id=$1
        WHERE id=$2`,
      [actionId, mission.id],
    );
    return {
      ok: false,
      status: "failed",
      tokens: 0,
      action_id: actionId,
      mission_id: mission.id,
      message,
    };
  }
}

async function applyOutputStrategyWeb(
  mission: AgentMission,
  agent: Member,
  content: string,
  meta: { tokens: number; actionId: number; toolCalls: unknown[] },
) {
  const cfg = mission.output_config ?? {};
  const strategy = mission.output_strategy;

  const commentMetadata = {
    mission_id: mission.id,
    mission_name: mission.name,
    agent_action_id: meta.actionId,
    tool_calls: meta.toolCalls,
    tokens_used: meta.tokens,
    cost_usd: 0,
  };

  if (strategy === "comment") {
    const taskId = Number(cfg.task_id);
    if (Number.isFinite(taskId) && taskId > 0) {
      await query(
        `INSERT INTO hei_work_comments (task_id, author_id, body, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [taskId, agent.id, content, JSON.stringify(commentMetadata)],
      );
    }
  } else if (strategy === "new_task") {
    const projectId = Number(cfg.project_id ?? 1);
    const titleTpl =
      typeof cfg.title_template === "string"
        ? cfg.title_template
        : `${mission.name} — {date}`;
    const title = titleTpl.replace("{date}", new Date().toISOString().slice(0, 10));
    const assignee = cfg.assignee_id ? Number(cfg.assignee_id) : agent.id;
    await query(
      `INSERT INTO hei_work_tasks
         (project_id, title, description, status, priority,
          assignee_id, task_type, created_by, metadata)
       VALUES ($1, $2, $3, 'review', 'medium', $4, 'mission', $5, $6::jsonb)`,
      [
        projectId,
        title,
        content,
        assignee,
        agent.id,
        JSON.stringify({ mission_id: mission.id, agent_action_id: meta.actionId }),
      ],
    );
  } else if (strategy === "vault_note") {
    const pathTpl =
      typeof cfg.path_template === "string"
        ? cfg.path_template
        : `informes/${agent.name.replace(/^@/, "")}/{date}.md`;
    const rel = pathTpl.replace("{date}", new Date().toISOString().slice(0, 10));
    const normalized = path.normalize(rel).replace(/^[/\\]+/, "");
    if (normalized.startsWith("..")) {
      throw new Error("path_template invalido");
    }
    const full = path.join(VAULT_ROOT, normalized);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const header = `---
tipo: informe
agente: ${agent.name}
mision: ${mission.name}
fecha: ${new Date().toISOString()}
tokens: ${meta.tokens}
---

`;
    await fs.writeFile(full, header + content, "utf8");
  } else if (strategy === "harry_send") {
    const channel = typeof cfg.channel === "string" ? cfg.channel : "telegram";
    const to = typeof cfg.to === "string" ? cfg.to : "";
    if (to) {
      const preview = content.length > 3500 ? content.slice(0, 3500) + "\n…" : content;
      await fetch(`${HARRY_URL}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(HARRY_TOKEN ? { Authorization: `Bearer ${HARRY_TOKEN}` } : {}),
        },
        body: JSON.stringify({ channel, to, message: preview }),
      });
    }
  }
}
