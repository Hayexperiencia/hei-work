// HEI Work — worker entry point
// Hace dos cosas:
// 1. Heartbeat cada 60s en hei_work_agent_memory para que /api/health sepa que esta vivo
// 2. Scheduler de agentes (node-cron) que recarga config cada 60s y dispara executor
//    cuando el cron de un agente activa.

import { pool, q } from "./db";
import { logger } from "./logger";
import { startScheduler } from "./scheduler";

const log = logger("main");

async function heartbeat() {
  try {
    const r = await q<{ id: number }>(
      `SELECT id FROM hei_work_members
        WHERE workspace_id = 1 AND name = '@Investigador'
        LIMIT 1`,
    );
    const agentId = r.rows[0]?.id;
    if (!agentId) {
      log.debug("no @Investigador yet");
      return;
    }
    await q(
      `INSERT INTO hei_work_agent_memory (agent_id, key, value, context, expires_at)
       VALUES ($1, 'worker_heartbeat', $2, 'system', NOW() + INTERVAL '10 minutes')`,
      [agentId, new Date().toISOString()],
    );
    await q(
      `DELETE FROM hei_work_agent_memory
        WHERE key = 'worker_heartbeat'
          AND id NOT IN (
            SELECT id FROM hei_work_agent_memory
             WHERE key = 'worker_heartbeat'
             ORDER BY created_at DESC LIMIT 5
          )`,
    );
    log.debug("heartbeat ok");
  } catch (err) {
    log.error("heartbeat fail", { err: (err as Error).message });
  }
}

async function main() {
  log.info("starting worker");
  await heartbeat();
  setInterval(() => {
    void heartbeat();
  }, 60_000);
  await startScheduler();
}

void main();

const shutdown = async (signal: string) => {
  log.info(`received ${signal}, draining`);
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
