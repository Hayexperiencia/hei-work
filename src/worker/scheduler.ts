// Scheduler — recarga config de agentes desde DB cada 60s y mantiene jobs cron
import { schedule, type ScheduledTask } from "node-cron";

import { q } from "./db";
import { runAgentBatch } from "./executor";
import { logger } from "./logger";
import type { AgentRow } from "./types";

const log = logger("scheduler");

interface JobEntry {
  cron: string;
  task: ScheduledTask;
}

const jobs = new Map<number, JobEntry>(); // agentId -> entry

async function loadActiveAgents(): Promise<AgentRow[]> {
  const r = await q<AgentRow>(
    `SELECT id, name, type, role, config, is_active
       FROM hei_work_members
      WHERE workspace_id = 1
        AND type = 'agent'
        AND is_active = true`,
  );
  return r.rows;
}

function isValidCron(expr: string): boolean {
  // node-cron acepta 5 o 6 campos. Validacion ligera.
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5 || parts.length === 6;
}

async function syncJobs() {
  const agents = await loadActiveAgents();
  const seen = new Set<number>();

  for (const agent of agents) {
    seen.add(agent.id);
    const desiredCron = (agent.config?.schedule ?? "").trim();
    if (!desiredCron || !isValidCron(desiredCron)) {
      // Sin schedule valido: si tenia un job lo quitamos
      const existing = jobs.get(agent.id);
      if (existing) {
        existing.task.stop();
        jobs.delete(agent.id);
        log.info(`stopped job for ${agent.name} (no valid schedule)`);
      }
      continue;
    }
    const existing = jobs.get(agent.id);
    if (existing && existing.cron === desiredCron) continue;
    if (existing) {
      existing.task.stop();
      jobs.delete(agent.id);
    }
    try {
      const task = schedule(
        desiredCron,
        async () => {
          log.info(`fire ${agent.name}`);
          try {
            // Reload agent config inside the fire to pick up edits
            const fresh = await q<AgentRow>(
              `SELECT id, name, type, role, config, is_active
                 FROM hei_work_members WHERE id=$1`,
              [agent.id],
            );
            const cur = fresh.rows[0];
            if (!cur || !cur.is_active) return;
            await runAgentBatch(cur);
          } catch (err) {
            log.error(`fire failed for ${agent.name}`, {
              err: (err as Error).message,
            });
          }
        },
        { timezone: "America/Bogota" },
      );
      task.start();
      jobs.set(agent.id, { cron: desiredCron, task });
      log.info(`scheduled ${agent.name} cron='${desiredCron}'`);
    } catch (err) {
      log.error(`schedule failed ${agent.name}`, { err: (err as Error).message });
    }
  }

  // Quitar jobs de agentes que ya no existen / inactivos
  for (const [agentId, entry] of jobs.entries()) {
    if (!seen.has(agentId)) {
      entry.task.stop();
      jobs.delete(agentId);
      log.info(`stopped job for agent ${agentId} (no longer active)`);
    }
  }
}

export async function startScheduler() {
  log.info("starting scheduler");
  await syncJobs();
  // Re-sync cada 60s para reflejar cambios de UI sin reiniciar
  setInterval(() => {
    void syncJobs();
  }, 60_000);
}

export function getJobsSnapshot(): Array<{ agent_id: number; cron: string }> {
  return Array.from(jobs.entries()).map(([agent_id, entry]) => ({
    agent_id,
    cron: entry.cron,
  }));
}
