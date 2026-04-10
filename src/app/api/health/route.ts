import { NextResponse } from "next/server";

import { pingDb, query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckResult = "ok" | "fail" | "skipped";

interface HealthResponse {
  status: "ok" | "degraded" | "fail";
  service: "hei-work";
  version: string;
  checks: {
    db: CheckResult;
    cliproxy: CheckResult;
    worker: CheckResult;
  };
  details: Record<string, unknown>;
  timestamp: string;
}

async function checkCliProxy(): Promise<CheckResult> {
  const url = process.env.CLIPROXY_URL ?? "http://localhost:8317";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`${url}/v1/models`, {
      method: "GET",
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
    return r.ok || r.status === 401 ? "ok" : "fail";
  } catch {
    return "fail";
  }
}

async function checkWorker(): Promise<{ result: CheckResult; lastTickAgo: number | null }> {
  // El worker hace heartbeat insertando una memoria efimera del agente Investigador.
  try {
    const r = await query<{ created_at: string }>(
      `SELECT created_at FROM hei_work_agent_memory
       WHERE key='worker_heartbeat'
       ORDER BY created_at DESC LIMIT 1`,
    );
    if (r.rows.length === 0) return { result: "skipped", lastTickAgo: null };
    const ageSec = Math.floor((Date.now() - new Date(r.rows[0].created_at).getTime()) / 1000);
    return { result: ageSec < 180 ? "ok" : "fail", lastTickAgo: ageSec };
  } catch {
    return { result: "fail", lastTickAgo: null };
  }
}

export async function GET() {
  const [dbOk, cliproxy, workerCheck] = await Promise.all([
    pingDb(),
    checkCliProxy(),
    checkWorker(),
  ]);

  const checks = {
    db: dbOk ? ("ok" as const) : ("fail" as const),
    cliproxy,
    worker: workerCheck.result,
  };

  const failed = Object.values(checks).some((v) => v === "fail");
  const skipped = Object.values(checks).some((v) => v === "skipped");

  const body: HealthResponse = {
    status: failed ? "fail" : skipped ? "degraded" : "ok",
    service: "hei-work",
    version: process.env.npm_package_version ?? "0.1.0",
    checks,
    details: {
      worker_last_tick_seconds_ago: workerCheck.lastTickAgo,
      cliproxy_url: process.env.CLIPROXY_URL ?? "http://localhost:8317",
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: failed ? 503 : 200 });
}
