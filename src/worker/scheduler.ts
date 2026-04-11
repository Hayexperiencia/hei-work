// Scheduler — recarga config de agentes + missions desde DB cada 60s
// y mantiene jobs cron para:
//   1. Agentes (para procesar tareas ad-hoc asignadas): key = `agent:${id}`
//   2. Misiones (trabajo recurrente): key = `mission:${id}`
import { schedule, type ScheduledTask } from "node-cron";

import { q } from "./db";
import { runAgentBatch } from "./executor";
import { logger } from "./logger";
import { executeMission, loadAgent, loadMission } from "./mission-executor";
import type { AgentRow } from "./types";

const log = logger("scheduler");

interface JobEntry {
  cron: string;
  task: ScheduledTask;
}

const jobs = new Map<string, JobEntry>(); // key -> entry

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

interface MissionBrief {
  id: number;
  agent_id: number;
  name: string;
  schedule: string | null;
}

async function loadActiveMissions(): Promise<MissionBrief[]> {
  const r = await q<MissionBrief>(
    `SELECT m.id, m.agent_id, m.name, m.schedule
       FROM hei_work_agent_missions m
       JOIN hei_work_members a ON a.id = m.agent_id
      WHERE m.is_active = true AND a.is_active = true`,
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
  const missions = await loadActiveMissions();
  const seen = new Set<string>();

  // === Jobs de AGENTES (para tareas ad-hoc) ===
  const agentByIdCache = new Map<number, AgentRow>();
  for (const agent of agents) {
    agentByIdCache.set(agent.id, agent);
    const key = `agent:${agent.id}`;
    seen.add(key);
    const desiredCron = (agent.config?.schedule ?? "").trim();
    if (!desiredCron || !isValidCron(desiredCron)) {
      const existing = jobs.get(key);
      if (existing) {
        existing.task.stop();
        jobs.delete(key);
        log.info(`stopped agent job ${agent.name} (no valid schedule)`);
      }
      continue;
    }
    const existing = jobs.get(key);
    if (existing && existing.cron === desiredCron) continue;
    if (existing) {
      existing.task.stop();
      jobs.delete(key);
    }
    try {
      const task = schedule(
        desiredCron,
        async () => {
          log.info(`fire agent ${agent.name}`);
          try {
            const fresh = await q<AgentRow>(
              `SELECT id, name, type, role, config, is_active
                 FROM hei_work_members WHERE id=$1`,
              [agent.id],
            );
            const cur = fresh.rows[0];
            if (!cur || !cur.is_active) return;
            await runAgentBatch(cur);
          } catch (err) {
            log.error(`fire agent failed ${agent.name}`, {
              err: (err as Error).message,
            });
          }
        },
        { timezone: "America/Bogota" },
      );
      task.start();
      jobs.set(key, { cron: desiredCron, task });
      log.info(`scheduled agent ${agent.name} cron='${desiredCron}'`);
    } catch (err) {
      log.error(`schedule agent failed ${agent.name}`, { err: (err as Error).message });
    }
  }

  // === Jobs de MISIONES ===
  for (const mission of missions) {
    const agent = agentByIdCache.get(mission.agent_id);
    if (!agent) continue; // agente inactivo -> mision no se programa
    const defaultCron = (agent.config?.schedule ?? "").trim();
    const desiredCron = (mission.schedule ?? defaultCron).trim();
    const key = `mission:${mission.id}`;
    seen.add(key);
    if (!desiredCron || !isValidCron(desiredCron)) {
      const existing = jobs.get(key);
      if (existing) {
        existing.task.stop();
        jobs.delete(key);
        log.info(`stopped mission ${mission.id} (no valid schedule)`);
      }
      continue;
    }
    const existing = jobs.get(key);
    if (existing && existing.cron === desiredCron) continue;
    if (existing) {
      existing.task.stop();
      jobs.delete(key);
    }
    try {
      const task = schedule(
        desiredCron,
        async () => {
          log.info(`fire mission "${mission.name}"`);
          try {
            const freshMission = await loadMission(mission.id);
            if (!freshMission || !freshMission.is_active) return;
            const freshAgent = await loadAgent(mission.agent_id);
            if (!freshAgent || !freshAgent.is_active) return;
            await executeMission(freshAgent, freshMission);
          } catch (err) {
            log.error(`fire mission failed ${mission.name}`, {
              err: (err as Error).message,
            });
          }
        },
        { timezone: "America/Bogota" },
      );
      task.start();
      jobs.set(key, { cron: desiredCron, task });
      log.info(`scheduled mission "${mission.name}" cron='${desiredCron}'`);
    } catch (err) {
      log.error(`schedule mission failed ${mission.name}`, { err: (err as Error).message });
    }
  }

  // === Limpieza de jobs obsoletos ===
  for (const [key, entry] of jobs.entries()) {
    if (!seen.has(key)) {
      entry.task.stop();
      jobs.delete(key);
      log.info(`stopped obsolete job ${key}`);
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

export function getJobsSnapshot(): Array<{ key: string; cron: string }> {
  return Array.from(jobs.entries()).map(([key, entry]) => ({
    key,
    cron: entry.cron,
  }));
}
