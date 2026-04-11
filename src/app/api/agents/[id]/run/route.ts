import { NextResponse } from "next/server";

import { badRequest, requireSession, serverError } from "@/lib/api-helpers";
import { listAssignedTasks, runAgentOnce } from "@/lib/agents/run-once";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // hasta 5 min para correr el LLM

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const agentId = Number(id);
  if (!Number.isFinite(agentId)) return badRequest("invalid id");

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }

  const taskIdRaw = body.task_id;
  const taskId = typeof taskIdRaw === "number" ? taskIdRaw : Number(taskIdRaw);

  try {
    if (Number.isFinite(taskId) && taskId > 0) {
      const result = await runAgentOnce(agentId, taskId);
      return NextResponse.json({ result });
    }

    // Sin task_id: tomar la primera tarea pendiente del agente
    const tasks = await listAssignedTasks(agentId, 1);
    if (tasks.length === 0) {
      return NextResponse.json({
        result: {
          ok: false,
          status: "skipped",
          message: "el agente no tiene tareas pendientes",
        },
      });
    }
    const result = await runAgentOnce(agentId, (tasks[0] as { id: number }).id);
    return NextResponse.json({ result });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const agentId = Number(id);
  if (!Number.isFinite(agentId)) return badRequest("invalid id");

  try {
    const tasks = await listAssignedTasks(agentId, 20);
    return NextResponse.json({ tasks });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
