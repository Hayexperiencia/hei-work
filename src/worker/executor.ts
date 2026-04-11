// Executor: corre una tarea concreta para un agente
import { getBudget } from "./budget-guard";
import { buildMessages } from "./context-builder";
import { q, withClient } from "./db";
import { chat, type ChatToolDef, type LlmMessage } from "./llm-client";
import { logger } from "./logger";
import { runTool, TOOL_DEFS } from "./tools";
import type { AgentRow, TaskRow } from "./types";

const log = logger("executor");
const MAX_TOOL_LOOPS = 4;

interface ExecutorResult {
  status: "done" | "review" | "failed" | "budget_exceeded" | "skipped";
  message?: string;
  tokens?: number;
}

async function insertAction(input: {
  agentId: number;
  taskId: number;
  actionType: string;
  status: string;
  inputJson: Record<string, unknown>;
}): Promise<number> {
  const r = await q<{ id: number }>(
    `INSERT INTO hei_work_agent_actions
       (agent_id, task_id, action_type, status, input)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id`,
    [
      input.agentId,
      input.taskId,
      input.actionType,
      input.status,
      JSON.stringify(input.inputJson),
    ],
  );
  return r.rows[0].id;
}

async function finishAction(
  actionId: number,
  patch: {
    status: string;
    output?: Record<string, unknown>;
    tokens?: number;
    durationMs?: number;
    error?: string;
  },
) {
  await q(
    `UPDATE hei_work_agent_actions
       SET status = $1,
           output = COALESCE($2::jsonb, output),
           tokens_used = COALESCE($3, tokens_used),
           duration_ms = $4,
           error = $5,
           completed_at = NOW()
     WHERE id = $6`,
    [
      patch.status,
      patch.output ? JSON.stringify(patch.output) : null,
      patch.tokens ?? null,
      patch.durationMs ?? null,
      patch.error ?? null,
      actionId,
    ],
  );
}

async function postComment(
  taskId: number,
  authorId: number,
  body: string,
  metadata: Record<string, unknown>,
) {
  await q(
    `INSERT INTO hei_work_comments (task_id, author_id, body, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [taskId, authorId, body, JSON.stringify(metadata)],
  );
}

async function moveTaskTo(taskId: number, targetStatus: string) {
  await q(
    `UPDATE hei_work_tasks
        SET status = $1::text,
            completed_at = CASE WHEN $1::text = 'done' THEN NOW() ELSE NULL END,
            updated_at = NOW()
      WHERE id = $2`,
    [targetStatus, taskId],
  );
}

export async function executeTaskForAgent(
  agent: AgentRow,
  task: TaskRow,
): Promise<ExecutorResult> {
  const start = Date.now();
  log.info(`run start agent=${agent.name} task=${task.id}`, { title: task.title });

  // 1. Budget guard
  const budget = await getBudget(agent);
  if (budget.over) {
    log.warn(`budget exceeded for ${agent.name}`, budget as unknown as Record<string, unknown>);
    const actionId = await insertAction({
      agentId: agent.id,
      taskId: task.id,
      actionType: "process_task",
      status: "budget_exceeded",
      inputJson: { reason: "monthly budget exhausted", budget },
    });
    await finishAction(actionId, { status: "budget_exceeded", durationMs: Date.now() - start });
    return { status: "budget_exceeded" };
  }

  const actionId = await insertAction({
    agentId: agent.id,
    taskId: task.id,
    actionType: "process_task",
    status: "running",
    inputJson: { task_title: task.title },
  });

  try {
    const enabledTools = agent.config.tools ?? [];
    const toolDefs: ChatToolDef[] = enabledTools
      .map((name) => TOOL_DEFS[name])
      .filter((t): t is ChatToolDef => Boolean(t));

    const messages: LlmMessage[] = await buildMessages(agent, task);

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

      log.info(`loop ${loop} tokens=${resp.totalTokens} tools=${resp.toolCalls.length}`);

      if (totalTokens > (agent.config.budget_tokens_per_run ?? 50000)) {
        await finishAction(actionId, {
          status: "budget_exceeded",
          tokens: totalTokens,
          durationMs: Date.now() - start,
          output: { reason: "per-run budget" },
        });
        return { status: "budget_exceeded", tokens: totalTokens };
      }

      if (resp.toolCalls.length === 0) {
        finalContent = resp.content;
        break;
      }

      // Push assistant's tool_calls into the conversation. Anthropic backend
      // exige incluir tool_calls en el assistant message para emparejar
      // las respuestas tool subsiguientes.
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
      finalContent = "(El agente no produjo respuesta final despues de agotar tools.)";
    }

    // Comment
    await postComment(task.id, agent.id, finalContent, {
      agent_action_id: actionId,
      tool_calls: toolCallsLog,
      tokens_used: totalTokens,
      cost_usd: 0,
      model: agent.config.model ?? "claude-sonnet-4-6",
    });

    // Status transition: research/analysis -> review (humano valida); resto -> done
    const reviewTypes = new Set(["research", "analysis", "nurture"]);
    const targetStatus = reviewTypes.has(task.task_type ?? "") ? "review" : "done";
    await moveTaskTo(task.id, targetStatus);

    await finishAction(actionId, {
      status: "done",
      tokens: totalTokens,
      durationMs: Date.now() - start,
      output: { final_status: targetStatus, tool_calls: toolCallsLog.length },
    });

    log.info(`run done agent=${agent.name} task=${task.id} -> ${targetStatus}`, {
      tokens: totalTokens,
      duration: Date.now() - start,
    });

    return { status: targetStatus === "done" ? "done" : "review", tokens: totalTokens };
  } catch (err) {
    const message = (err as Error).message;
    log.error(`run failed agent=${agent.name} task=${task.id}`, { err: message });
    await finishAction(actionId, {
      status: "failed",
      error: message,
      durationMs: Date.now() - start,
    });
    await postComment(task.id, agent.id, `**Error al ejecutar:** ${message}`, {
      agent_action_id: actionId,
      tokens_used: 0,
      cost_usd: 0,
      error: true,
    });
    return { status: "failed", message };
  }
}

export async function runAgentBatch(agent: AgentRow): Promise<{
  processed: number;
  results: ExecutorResult[];
}> {
  // Trae las tareas asignadas en estados activos
  const r = await q<TaskRow & { project_name: string }>(
    `SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority,
            t.assignee_id, t.due_date::text AS due_date, t.labels, t.task_type, t.metadata,
            p.name AS project_name
       FROM hei_work_tasks t
       JOIN hei_work_projects p ON p.id = t.project_id
      WHERE t.assignee_id = $1
        AND t.status IN ('backlog', 'in_progress')
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        t.created_at
      LIMIT 5`,
    [agent.id],
  );

  if (r.rows.length === 0) {
    log.info(`no tasks for ${agent.name}`);
    return { processed: 0, results: [] };
  }

  const results: ExecutorResult[] = [];
  for (const task of r.rows) {
    const res = await executeTaskForAgent(agent, task);
    results.push(res);
    if (res.status === "budget_exceeded") {
      log.warn(`stopping batch — budget exceeded for ${agent.name}`);
      break;
    }
  }
  return { processed: results.length, results };
}
