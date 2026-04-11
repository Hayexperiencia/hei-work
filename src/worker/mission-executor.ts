// Mission executor — corre una mision de un agente (no una tarea asignada)
// Similar al executor normal pero:
// - El "prompt del usuario" es mission.instructions (no task.description)
// - El output va segun mission.output_strategy (no comment en una tarea)
import * as fs from "fs/promises";
import * as path from "path";

import { getBudget } from "./budget-guard";
import { q } from "./db";
import { chat, type ChatToolDef, type LlmMessage } from "./llm-client";
import { logger } from "./logger";
import { runTool, TOOL_DEFS } from "./tools";
import type { AgentRow } from "./types";

const log = logger("mission-exec");
const MAX_TOOL_LOOPS = 8;

interface MissionRow {
  id: number;
  agent_id: number;
  name: string;
  description: string | null;
  instructions: string;
  output_strategy: string;
  output_config: Record<string, unknown>;
  is_active: boolean;
}

const VAULT_ROOT = process.env.VAULT_PATH ?? "/vault";
const HARRY_URL = process.env.HARRY_URL ?? "http://localhost:18789";
const HARRY_TOKEN = process.env.HARRY_TOKEN ?? "";

export async function executeMission(
  agent: AgentRow,
  mission: MissionRow,
): Promise<{ status: string; tokens: number; actionId: number | null; message?: string }> {
  const start = Date.now();
  log.info(`mission start agent=${agent.name} mission="${mission.name}"`);

  // Budget check
  const budget = await getBudget(agent);
  if (budget.over) {
    log.warn(`mission budget exceeded ${agent.name}`);
    return { status: "budget_exceeded", tokens: 0, actionId: null };
  }

  // Insert agent_action (task_id null porque es mision recurrente)
  const actionR = await q<{ id: number }>(
    `INSERT INTO hei_work_agent_actions
       (agent_id, task_id, action_type, status, input)
     VALUES ($1, NULL, 'mission', 'running', $2::jsonb)
     RETURNING id`,
    [
      agent.id,
      JSON.stringify({
        mission_id: mission.id,
        mission_name: mission.name,
        source: "scheduled",
      }),
    ],
  );
  const actionId = actionR.rows[0].id;

  try {
    const enabledTools = agent.config.tools ?? [];
    const toolDefs: ChatToolDef[] = enabledTools
      .map((name) => TOOL_DEFS[name])
      .filter((t): t is ChatToolDef => Boolean(t));

    const soul = agent.config.soul_text ?? `(SOUL no configurado para ${agent.name})`;

    const systemMsg = `Estas operando como el agente ${agent.name} dentro de HEI Work.
Cumples la identidad y los limites definidos en tu SOUL.

# Tu identidad (SOUL)
${soul}

# Modo de operacion
Estas ejecutando una MISION recurrente programada, NO una tarea asignada por un humano.
Tu output final se procesara segun la estrategia configurada. Produce un resultado
accionable y conciso en markdown.

REGLAS:
- Usa markdown con TL;DR arriba, detalles abajo.
- Cita fuentes cuando uses datos (tool calls que hiciste).
- Si necesitas datos que no tienes acceso, dilo explicitamente.
- Solo puedes usar las tools listadas en tu config.
- Si una accion esta fuera de tu permiso o presupuesto, NO la intentes; explica por que.`;

    const userMsg = `# Mision: ${mission.name}

${mission.description ? `${mission.description}\n\n` : ""}## Instrucciones
${mission.instructions}

Ejecuta ahora.`;

    const messages: LlmMessage[] = [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ];

    let totalTokens = 0;
    const toolCallsLog: Array<{ name: string; args: string; ok: boolean; output: string }> = [];
    let finalContent = "";

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const resp = await chat({
        model: agent.config.model ?? "claude-sonnet-4-6",
        temperature: agent.config.temperature ?? 0.3,
        maxTokens: 4000,
        messages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
      });
      totalTokens += resp.totalTokens;

      if (totalTokens > (agent.config.budget_tokens_per_run ?? 50000)) {
        await q(
          `UPDATE hei_work_agent_actions
              SET status = 'budget_exceeded',
                  tokens_used = $1,
                  duration_ms = $2,
                  completed_at = NOW(),
                  output = $3::jsonb
            WHERE id = $4`,
          [
            totalTokens,
            Date.now() - start,
            JSON.stringify({ reason: "per_run_exceeded" }),
            actionId,
          ],
        );
        return { status: "budget_exceeded", tokens: totalTokens, actionId };
      }

      if (resp.toolCalls.length === 0) {
        finalContent = resp.content;
        break;
      }

      messages.push({
        role: "assistant",
        content: resp.content || "",
        tool_calls: resp.toolCalls,
      } as unknown as LlmMessage);

      for (const tc of resp.toolCalls) {
        const result = await runTool(
          { agentId: agent.id, enabledTools },
          tc.function.name,
          tc.function.arguments,
        );
        toolCallsLog.push({
          name: tc.function.name,
          args: tc.function.arguments,
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
    await applyOutputStrategy(mission, agent, finalContent, {
      tokens: totalTokens,
      actionId,
      toolCalls: toolCallsLog,
    });

    await q(
      `UPDATE hei_work_agent_actions
          SET status = 'done',
              tokens_used = $1,
              duration_ms = $2,
              output = $3::jsonb,
              completed_at = NOW()
        WHERE id = $4`,
      [
        totalTokens,
        Date.now() - start,
        JSON.stringify({
          mission_id: mission.id,
          output_strategy: mission.output_strategy,
          tool_calls: toolCallsLog.length,
          final_len: finalContent.length,
        }),
        actionId,
      ],
    );

    log.info(`mission done ${agent.name} "${mission.name}" tokens=${totalTokens}`);
    return { status: "done", tokens: totalTokens, actionId };
  } catch (err) {
    const message = (err as Error).message;
    log.error(`mission failed ${agent.name} "${mission.name}"`, { err: message });
    await q(
      `UPDATE hei_work_agent_actions
          SET status = 'failed', error = $1, duration_ms = $2, completed_at = NOW()
        WHERE id = $3`,
      [message, Date.now() - start, actionId],
    );
    return { status: "failed", tokens: 0, actionId, message };
  }
}

async function applyOutputStrategy(
  mission: MissionRow,
  agent: AgentRow,
  content: string,
  meta: { tokens: number; actionId: number; toolCalls: unknown[] },
) {
  const strategy = mission.output_strategy;
  const cfg = mission.output_config ?? {};
  const commentMetadata = {
    mission_id: mission.id,
    mission_name: mission.name,
    agent_action_id: meta.actionId,
    tool_calls: meta.toolCalls,
    tokens_used: meta.tokens,
    cost_usd: 0,
  };

  try {
    if (strategy === "comment") {
      const taskId = Number(cfg.task_id);
      if (Number.isFinite(taskId) && taskId > 0) {
        await q(
          `INSERT INTO hei_work_comments (task_id, author_id, body, metadata)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [taskId, agent.id, content, JSON.stringify(commentMetadata)],
        );
      } else {
        log.warn(`mission ${mission.id} strategy=comment pero no hay task_id valido en config`);
      }
    } else if (strategy === "new_task") {
      const projectId = Number(cfg.project_id ?? 1);
      const titleTpl =
        typeof cfg.title_template === "string"
          ? cfg.title_template
          : `${mission.name} — ${new Date().toLocaleDateString("es-CO")}`;
      const title = titleTpl.replace("{date}", new Date().toISOString().slice(0, 10));
      const assignee = cfg.assignee_id ? Number(cfg.assignee_id) : agent.id;
      const tR = await q<{ id: number }>(
        `INSERT INTO hei_work_tasks
           (project_id, title, description, status, priority,
            assignee_id, task_type, created_by, metadata)
         VALUES ($1, $2, $3, 'review', 'medium', $4, 'mission', $5, $6::jsonb)
         RETURNING id`,
        [
          projectId,
          title,
          content,
          assignee,
          agent.id,
          JSON.stringify({ mission_id: mission.id, agent_action_id: meta.actionId }),
        ],
      );
      log.info(`mission created task id=${tR.rows[0].id}`);
    } else if (strategy === "vault_note") {
      const pathTpl =
        typeof cfg.path_template === "string"
          ? cfg.path_template
          : `informes/${agent.name.replace(/^@/, "")}/{date}.md`;
      const rel = pathTpl.replace("{date}", new Date().toISOString().slice(0, 10));
      const full = path.join(VAULT_ROOT, rel);
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
      log.info(`mission wrote vault note ${rel}`);
    } else if (strategy === "harry_send") {
      const channel = typeof cfg.channel === "string" ? cfg.channel : "telegram";
      const to = typeof cfg.to === "string" ? cfg.to : "";
      if (!to) {
        log.warn(`mission ${mission.id} harry_send sin 'to'`);
      } else {
        const preview = content.length > 3500 ? content.slice(0, 3500) + "\n…" : content;
        const r = await fetch(`${HARRY_URL}/messages/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(HARRY_TOKEN ? { Authorization: `Bearer ${HARRY_TOKEN}` } : {}),
          },
          body: JSON.stringify({ channel, to, message: preview }),
        });
        log.info(`harry_send ${r.status}`);
      }
    } else if (strategy === "multi") {
      // futuro: ejecutar multiples estrategias secuencialmente
      log.warn(`mission ${mission.id} strategy=multi no implementado`);
    }

    // Actualizar last_run en la mision
    await q(
      `UPDATE hei_work_agent_missions
          SET last_run_at = NOW(),
              last_run_status = 'done',
              last_run_action_id = $1,
              fire_count = fire_count + 1
        WHERE id = $2`,
      [meta.actionId, mission.id],
    );
  } catch (err) {
    await q(
      `UPDATE hei_work_agent_missions
          SET last_run_at = NOW(),
              last_run_status = 'failed',
              last_run_action_id = $1
        WHERE id = $2`,
      [meta.actionId, mission.id],
    );
    throw err;
  }
}

export async function loadMission(missionId: number): Promise<MissionRow | null> {
  const r = await q<MissionRow>(
    `SELECT * FROM hei_work_agent_missions WHERE id = $1`,
    [missionId],
  );
  return r.rows[0] ?? null;
}

export async function loadAgent(agentId: number): Promise<AgentRow | null> {
  const r = await q<AgentRow>(
    `SELECT id, name, type, role, config, is_active
       FROM hei_work_members WHERE id = $1`,
    [agentId],
  );
  return r.rows[0] ?? null;
}
