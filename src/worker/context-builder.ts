// Construye los mensajes que se envian al LLM para una tarea concreta
import { q } from "./db";
import type { LlmMessage } from "./llm-client";
import type { AgentRow, CommentRow, TaskRow } from "./types";

const SYSTEM_FRAME = `
Estas operando dentro de HEI Work, el sistema interno de gestion de HayExperiencia SAS.
Cumples la identidad y los limites definidos en tu SOUL.
Tu output principal son comentarios en hilos de tareas y, opcionalmente, llamadas a tools.

REGLAS DE OUTPUT:
- Tu respuesta final (despues de cualquier tool) sera publicada como comentario en la tarea.
- Usa markdown. Estructura clara: TL;DR arriba si aplica.
- Si necesitas decision humana, dilo explicitamente y sugiere a quien escalar.
- Si una accion esta fuera de tu permiso o presupuesto, NO la intentes; explica por que.

REGLAS DE TOOLS:
- Solo puedes usar las tools listadas en tu config.
- Verifica los argumentos antes de invocar.
- Si una tool falla, intenta una alternativa o reporta el error en tu respuesta final.
`.trim();

export async function getRecentComments(taskId: number, limit = 10): Promise<CommentRow[]> {
  const r = await q<CommentRow>(
    `SELECT c.id, c.task_id, c.author_id, c.body, c.created_at,
            m.name AS author_name
       FROM hei_work_comments c
       LEFT JOIN hei_work_members m ON m.id = c.author_id
      WHERE c.task_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2`,
    [taskId, limit],
  );
  return r.rows.reverse();
}

export async function getAgentMemory(agentId: number, taskTitle: string): Promise<string> {
  // Heuristica simple: trae memorias cuyas keys o context aparecen en el titulo
  // de la tarea (case-insensitive). Mejora futura: embeddings.
  const r = await q<{ key: string; value: string; context: string | null }>(
    `SELECT key, value, context
       FROM hei_work_agent_memory
      WHERE agent_id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 50`,
    [agentId],
  );
  if (r.rows.length === 0) return "";
  const lower = taskTitle.toLowerCase();
  const relevant = r.rows.filter((m) => {
    const k = m.key.toLowerCase();
    const c = (m.context ?? "").toLowerCase();
    if (k === "worker_heartbeat") return false;
    if (lower.includes(k.replace(/_/g, " "))) return true;
    if (c && lower.includes(c)) return true;
    return false;
  });
  const finalSet = relevant.length > 0 ? relevant : r.rows.slice(0, 5);
  return finalSet
    .map((m) => `- **${m.key}**${m.context ? ` (${m.context})` : ""}: ${m.value}`)
    .join("\n");
}

export async function buildMessages(
  agent: AgentRow,
  task: TaskRow,
): Promise<LlmMessage[]> {
  const soul = agent.config.soul_text ?? `(SOUL no configurado para ${agent.name})`;
  const comments = await getRecentComments(task.id, 10);
  const memory = await getAgentMemory(agent.id, task.title);

  const sys = `${SYSTEM_FRAME}

# Tu identidad (SOUL)
${soul}`;

  const taskContext = `
# Tarea a procesar

**ID:** ${task.id}
**Titulo:** ${task.title}
**Proyecto:** ${task.project_name ?? task.project_id}
**Estado:** ${task.status}
**Prioridad:** ${task.priority}
**Tipo:** ${task.task_type ?? "manual"}
**Fecha limite:** ${task.due_date ?? "—"}
**Etiquetas:** ${(task.labels ?? []).join(", ") || "—"}

## Descripcion
${task.description ?? "(sin descripcion)"}

## Hilo reciente (${comments.length} comentarios)
${
  comments.length === 0
    ? "(sin comentarios)"
    : comments
        .map(
          (c) =>
            `**${c.author_name ?? "anon"}** (${new Date(c.created_at).toISOString()}):\n${c.body}`,
        )
        .join("\n\n---\n\n")
}

${memory ? `## Tu memoria relevante\n${memory}` : ""}
`.trim();

  return [
    { role: "system", content: sys },
    { role: "user", content: taskContext + "\n\nProcesa la tarea." },
  ];
}
