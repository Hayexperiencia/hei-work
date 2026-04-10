// HEI Work — worker placeholder (Sprint 1)
// El worker real con node-cron y executor de agentes llega en Sprint 3.
// Por ahora solo escribe un heartbeat cada 60s para validar el ciclo
// y darle senal al endpoint /api/health.

import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@postgres-hayexperiencia:5432/hayexperiencia",
  max: 2,
});

const log = (msg: string) => {
  // eslint-disable-next-line no-console
  console.log(`[worker] ${new Date().toISOString()} ${msg}`);
};

async function heartbeat() {
  try {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM hei_work_members
        WHERE workspace_id = 1 AND name = '@Investigador'
        LIMIT 1`,
    );
    const agentId = r.rows[0]?.id;
    if (!agentId) {
      log("no @Investigador agent yet, skipping heartbeat");
      return;
    }

    await pool.query(
      `INSERT INTO hei_work_agent_memory (agent_id, key, value, context, expires_at)
       VALUES ($1, 'worker_heartbeat', $2, 'system', NOW() + INTERVAL '10 minutes')`,
      [agentId, new Date().toISOString()],
    );

    // Mantener la tabla pequena: solo nos interesa el ultimo heartbeat
    await pool.query(
      `DELETE FROM hei_work_agent_memory
        WHERE key = 'worker_heartbeat'
          AND id NOT IN (
            SELECT id FROM hei_work_agent_memory
             WHERE key = 'worker_heartbeat'
             ORDER BY created_at DESC LIMIT 5
          )`,
    );
    log("heartbeat ok");
  } catch (err) {
    log(`heartbeat fail: ${(err as Error).message}`);
  }
}

async function main() {
  log("starting worker (placeholder)");
  await heartbeat();
  setInterval(heartbeat, 60_000);
}

void main();

const shutdown = async (signal: string) => {
  log(`received ${signal}, draining`);
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
