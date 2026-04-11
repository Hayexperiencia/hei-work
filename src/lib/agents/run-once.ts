// Ejecucion sincrona de una tarea para un agente desde el contexto Next.js (API routes).
// Reusa los mismos shapes que el worker pero usa @/lib/db (singleton) y no tiene cron.

import { query, withClient } from "@/lib/db";

import { TOOL_DEFS, runToolWeb, type ToolContextWeb } from "./tools";

interface AgentDb {
  id: number;
  name: string;
  type: "human" | "agent";
  config: AgentConfigShape;
}

interface AgentConfigShape {
  soul?: string;
  soul_text?: string;
  model?: string;
  temperature?: number;
  schedule?: string;
  budget_tokens_per_run?: number;
  budget_tokens_per_month?: number;
  tools?: string[];
  permissions?: Record<string, boolean>;
}

interface TaskRow {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: number | null;
  due_date: string | null;
  labels: string[];
  task_type: string | null;
  metadata: Record<string, unknown>;
  project_name: string;
}

export interface RunOnceResult {
  ok: boolean;
  status: "done" | "review" | "failed" | "budget_exceeded";
  tokens: number;
  comment_id?: number;
  action_id: number;
  message: string;
  tool_calls: Array<{ name: string; ok: boolean; output: string }>;
}

const DEFAULT_RUN_BUDGET = 50_000;
const DEFAULT_MONTH_BUDGET = 500_000;
const MAX_TOOL_LOOPS = 4;

export async function runAgentOnce(
  agentId: number,
  taskId: number,
): Promise<RunOnceResult> {
  const start = Date.now();

  const ar = await query<AgentDb>(
    `SELECT id, name, type, config FROM hei_work_members
      WHERE id = $1 AND type='agent' AND is_active=true`,
    [agentId],
  );
  const agent = ar.rows[0];
  if (!agent) {
    return {
      ok: false,
      status: "failed",
      tokens: 0,
      action_id: 0,
      message: "agente no encontrado o inactivo",
      tool_calls: [],
    };
  }

  const tr = await query<TaskRow>(
    `SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority,
            t.assignee_id, t.due_date::text AS due_date, t.labels, t.task_type, t.metadata,
            p.name AS project_name
       FROM hei_work_tasks t
       JOIN hei_work_projects p ON p.id = t.project_id
      WHERE t.id = $1`,
    [taskId],
  );
  const task = tr.rows[0];
  if (!task) {
    return {
      ok: false,
      status: "failed",
      tokens: 0,
      action_id: 0,
      message: "tarea no encontrada",
      tool_calls: [],
    };
  }

  // Budget check
  const monthLimit = agent.config.budget_tokens_per_month ?? DEFAULT_MONTH_BUDGET;
  const runLimit = agent.config.budget_tokens_per_run ?? DEFAULT_RUN_BUDGET;
  const usedR = await query<{ used: number }>(
    `SELECT COALESCE(SUM(tokens_used),0)::int AS used
       FROM hei_work_agent_actions
      WHERE agent_id = $1 AND created_at >= date_trunc('month', NOW())`,
    [agent.id],
  );
  const usedMonth = usedR.rows[0]?.used ?? 0;
  if (usedMonth >= monthLimit) {
    const ar2 = await query<{ id: number }>(
      `INSERT INTO hei_work_agent_actions
         (agent_id, task_id, action_type, status, input)
       VALUES ($1, $2, 'process_task', 'budget_exceeded', $3::jsonb)
       RETURNING id`,
      [agent.id, task.id, JSON.stringify({ reason: "monthly_exceeded" })],
    );
    return {
      ok: false,
      status: "budget_exceeded",
      tokens: 0,
      action_id: ar2.rows[0].id,
      message: "budget mensual agotado",
      tool_calls: [],
    };
  }

  const actionR = await query<{ id: number }>(
    `INSERT INTO hei_work_agent_actions
       (agent_id, task_id, action_type, status, input)
     VALUES ($1, $2, 'process_task', 'running', $3::jsonb)
     RETURNING id`,
    [agent.id, task.id, JSON.stringify({ task_title: task.title, source: "run_now" })],
  );
  const actionId = actionR.rows[0].id;

  try {
    const enabledTools = agent.config.tools ?? [];
    const toolDefs = enabledTools
      .map((n) => TOOL_DEFS[n])
      .filter((d): d is NonNullable<typeof d> => Boolean(d));

    // Build context
    const recentR = await query<{
      author_name: string | null;
      body: string;
      created_at: string;
    }>(
      `SELECT m.name AS author_name, c.body, c.created_at
         FROM hei_work_comments c
         LEFT JOIN hei_work_members m ON m.id = c.author_id
        WHERE c.task_id = $1
        ORDER BY c.created_at DESC LIMIT 10`,
      [task.id],
    );
    const recent = recentR.rows.reverse();

    const memR = await query<{ key: string; value: string; context: string | null }>(
      `SELECT key, value, context
         FROM hei_work_agent_memory
        WHERE agent_id = $1
          AND key <> 'worker_heartbeat'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC LIMIT 50`,
      [agent.id],
    );
    const memorySummary =
      memR.rows.length === 0
        ? ""
        : memR.rows
            .slice(0, 10)
            .map((m) => `- **${m.key}**${m.context ? ` (${m.context})` : ""}: ${m.value}`)
            .join("\n");

    const soul = agent.config.soul_text ?? `(SOUL no configurado para ${agent.name})`;

    const systemMsg = `Estas operando dentro de HEI Work. Cumples la identidad y los limites de tu SOUL.
Tu output principal es un comentario en la tarea.
REGLAS:
- Usa markdown. TL;DR arriba si aplica.
- Si necesitas decision humana, dilo y sugiere a quien escalar.
- Si una accion esta fuera de tus permisos o presupuesto, NO la intentes.
- Solo puedes usar las tools listadas en tu config.

# Tu identidad (SOUL)
${soul}`;

    const userMsg = `# Tarea a procesar

**ID:** ${task.id}
**Titulo:** ${task.title}
**Proyecto:** ${task.project_name}
**Estado:** ${task.status}
**Prioridad:** ${task.priority}
**Tipo:** ${task.task_type ?? "manual"}
**Fecha limite:** ${task.due_date ?? "—"}
**Etiquetas:** ${(task.labels ?? []).join(", ") || "—"}

## Descripcion
${task.description ?? "(sin descripcion)"}

## Hilo reciente (${recent.length} comentarios)
${
  recent.length === 0
    ? "(sin comentarios)"
    : recent
        .map(
          (c) =>
            `**${c.author_name ?? "anon"}** (${new Date(c.created_at).toISOString()}):\n${c.body}`,
        )
        .join("\n\n---\n\n")
}

${memorySummary ? `## Tu memoria relevante\n${memorySummary}` : ""}

Procesa la tarea.`;

    interface ToolCallShape {
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }
    interface MsgShape {
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      tool_call_id?: string;
      tool_calls?: ToolCallShape[];
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
        model: agent.config.model ?? "claude-sonnet-4-6",
        messages,
        temperature: agent.config.temperature ?? 0.3,
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
          finish_reason?: string;
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
                  duration_ms=$2,
                  output=$3::jsonb
            WHERE id=$4`,
          [
            totalTokens,
            Date.now() - start,
            JSON.stringify({ reason: "per_run_exceeded" }),
            actionId,
          ],
        );
        return {
          ok: false,
          status: "budget_exceeded",
          tokens: totalTokens,
          action_id: actionId,
          message: "budget por run agotado",
          tool_calls: toolCallsLog,
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
        const ctxTool: ToolContextWeb = {
          agentId: agent.id,
          enabledTools,
        };
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
      finalContent = "(El agente no produjo respuesta final despues de agotar el loop de tools.)";
    }

    // Insert comment
    const cR = await query<{ id: number }>(
      `INSERT INTO hei_work_comments (task_id, author_id, body, metadata)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [
        task.id,
        agent.id,
        finalContent,
        JSON.stringify({
          agent_action_id: actionId,
          tool_calls: toolCallsLog,
          tokens_used: totalTokens,
          cost_usd: 0,
          model: agent.config.model ?? "claude-sonnet-4-6",
          source: "run_now",
        }),
      ],
    );
    const commentId = cR.rows[0].id;

    // Move task
    const reviewTypes = new Set(["research", "analysis", "nurture"]);
    const targetStatus = reviewTypes.has(task.task_type ?? "") ? "review" : "done";
    await query(
      `UPDATE hei_work_tasks
          SET status=$1::text,
              completed_at=CASE WHEN $1::text='done' THEN NOW() ELSE NULL END,
              updated_at=NOW()
        WHERE id=$2`,
      [targetStatus, task.id],
    );

    await query(
      `UPDATE hei_work_agent_actions
          SET status='done',
              tokens_used=$1,
              duration_ms=$2,
              output=$3::jsonb,
              completed_at=NOW()
        WHERE id=$4`,
      [
        totalTokens,
        Date.now() - start,
        JSON.stringify({ final_status: targetStatus, tool_calls: toolCallsLog.length }),
        actionId,
      ],
    );

    return {
      ok: true,
      status: targetStatus === "done" ? "done" : "review",
      tokens: totalTokens,
      comment_id: commentId,
      action_id: actionId,
      message: "ejecucion completada",
      tool_calls: toolCallsLog,
    };
  } catch (err) {
    const message = (err as Error).message;
    const stack = (err as Error).stack ?? "";
    // eslint-disable-next-line no-console
    console.error(`[run-once] agent=${agentId} task=${taskId} failed:`, message);
    // eslint-disable-next-line no-console
    console.error(stack);
    await query(
      `UPDATE hei_work_agent_actions
          SET status='failed', error=$1, duration_ms=$2, completed_at=NOW()
        WHERE id=$3`,
      [message + "\n" + stack.split("\n").slice(0, 5).join("\n"), Date.now() - start, actionId],
    );
    await query(
      `INSERT INTO hei_work_comments (task_id, author_id, body, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        task.id,
        agent.id,
        `**Error al ejecutar:** ${message}`,
        JSON.stringify({ agent_action_id: actionId, error: true }),
      ],
    );
    return {
      ok: false,
      status: "failed",
      tokens: 0,
      action_id: actionId,
      message,
      tool_calls: [],
    };
  }
}

// Re-export query helper used by /api/agents/[id]/run when listing tasks
export async function listAssignedTasks(agentId: number, limit = 20) {
  const r = await query(
    `SELECT t.id, t.title, t.status, t.priority, t.task_type, t.due_date,
            p.name AS project_name
       FROM hei_work_tasks t
       JOIN hei_work_projects p ON p.id = t.project_id
      WHERE t.assignee_id = $1
        AND t.status IN ('backlog','in_progress')
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
        END, t.created_at
      LIMIT $2`,
    [agentId, limit],
  );
  return r.rows;
}

// withClient export so tests can verify (no real use here)
export { withClient };
