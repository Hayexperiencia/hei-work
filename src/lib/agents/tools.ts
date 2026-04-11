// Tools para uso desde el web (Next.js API). Mismas validaciones que el worker
// pero usa @/lib/db para queries y fetch nativo para Harry.
import * as fs from "fs/promises";
import * as path from "path";

import { query } from "@/lib/db";

export interface ChatToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const TOOL_DEFS: Record<string, ChatToolDef> = {
  vault_read: {
    type: "function",
    function: {
      name: "vault_read",
      description:
        "Lee un archivo markdown del vault de Obsidian. Path relativo a la raiz del vault.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  vault_list: {
    type: "function",
    function: {
      name: "vault_list",
      description: "Lista archivos y carpetas en una ruta del vault.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  db_read: {
    type: "function",
    function: {
      name: "db_read",
      description:
        "SELECT en tablas del cotizador (hei_projects, hei_inventory_units, hei_quotations, hei_project_stages).",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string" },
          params: { type: "array", items: {} },
        },
        required: ["sql"],
      },
    },
  },
  hw_read: {
    type: "function",
    function: {
      name: "hw_read",
      description:
        "SELECT en tablas de HEI Work (tasks, projects, members, comments, agent_actions, agent_memory).",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string" },
          params: { type: "array", items: {} },
        },
        required: ["sql"],
      },
    },
  },
  harry_send: {
    type: "function",
    function: {
      name: "harry_send",
      description:
        "Envia un mensaje via Harry (Telegram/WhatsApp del CEO). Solo para notificaciones urgentes.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["telegram", "whatsapp"] },
          to: { type: "string" },
          message: { type: "string" },
        },
        required: ["channel", "to", "message"],
      },
    },
  },
  agent_memory_write: {
    type: "function",
    function: {
      name: "agent_memory_write",
      description: "Guarda una memoria persistente del agente.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
          context: { type: "string" },
        },
        required: ["key", "value"],
      },
    },
  },
};

const READ_TABLES = new Set([
  "hei_projects",
  "hei_inventory_units",
  "hei_quotations",
  "hei_project_stages",
  "hei_system_config",
  "hei_unit_type_images",
]);

const HW_READ_TABLES = new Set([
  "hei_work_tasks",
  "hei_work_projects",
  "hei_work_members",
  "hei_work_comments",
  "hei_work_agent_actions",
  "hei_work_agent_memory",
  "hei_work_workspaces",
  "hei_work_statuses",
]);

function isSelectOnly(sql: string): boolean {
  const trimmed = sql.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed.startsWith("select") && !trimmed.startsWith("with")) return false;
  const forbidden = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|;.*select)\b/;
  return !forbidden.test(trimmed);
}

function tablesUsed(sql: string): string[] {
  const matches = sql.toLowerCase().matchAll(/\b(?:from|join)\s+([a-z_][\w]*)/g);
  return Array.from(matches).map((m) => m[1]);
}

function safeJoin(root: string, rel: string): string | null {
  const normalized = path.normalize(rel).replace(/^[/\\]+/, "");
  if (normalized.startsWith("..") || normalized.includes("\0")) return null;
  return path.join(root, normalized);
}

export interface ToolContextWeb {
  agentId: number;
  enabledTools: string[];
}

export async function runToolWeb(
  ctx: ToolContextWeb,
  name: string,
  argsRaw: string,
): Promise<{ ok: boolean; output: string }> {
  if (!ctx.enabledTools.includes(name)) {
    return { ok: false, output: `Tool '${name}' no esta habilitada para este agente.` };
  }
  let args: Record<string, unknown> = {};
  try {
    args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
  } catch {
    return { ok: false, output: "argumentos invalidos (no JSON)" };
  }

  try {
    switch (name) {
      case "vault_read":
        return await vaultRead(args);
      case "vault_list":
        return await vaultList(args);
      case "db_read":
        return await dbRead(args);
      case "hw_read":
        return await hwRead(args);
      case "harry_send":
        return await harrySend(args);
      case "agent_memory_write":
        return await memoryWrite(ctx.agentId, args);
      default:
        return { ok: false, output: `tool desconocida: ${name}` };
    }
  } catch (err) {
    return { ok: false, output: `error: ${(err as Error).message}` };
  }
}

const VAULT_ROOT = process.env.VAULT_PATH ?? "/vault";
const HARRY_URL = process.env.HARRY_URL ?? "http://localhost:18789";
const HARRY_TOKEN = process.env.HARRY_TOKEN ?? "";

async function vaultRead(args: Record<string, unknown>) {
  const rel = typeof args.path === "string" ? args.path : "";
  const full = safeJoin(VAULT_ROOT, rel);
  if (!full) return { ok: false, output: "path invalido" };
  try {
    const stat = await fs.stat(full);
    if (!stat.isFile()) return { ok: false, output: "no es archivo" };
    if (stat.size > 200_000) return { ok: false, output: "archivo muy grande" };
    const content = await fs.readFile(full, "utf8");
    return { ok: true, output: content };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, output: `archivo no encontrado o vault no montado en ${VAULT_ROOT}` };
    }
    throw err;
  }
}

async function vaultList(args: Record<string, unknown>) {
  const rel = typeof args.path === "string" ? args.path : "";
  const full = safeJoin(VAULT_ROOT, rel);
  if (!full) return { ok: false, output: "path invalido" };
  try {
    const entries = await fs.readdir(full, { withFileTypes: true });
    return {
      ok: true,
      output:
        entries
          .filter((e) => !e.name.startsWith("."))
          .map((e) => `${e.isDirectory() ? "[dir]" : "[file]"} ${e.name}`)
          .slice(0, 200)
          .join("\n") || "(vacio)",
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, output: `path no encontrado en ${VAULT_ROOT}` };
    }
    throw err;
  }
}

async function dbRead(args: Record<string, unknown>) {
  const sql = typeof args.sql === "string" ? args.sql : "";
  const params = Array.isArray(args.params) ? (args.params as unknown[]) : [];
  if (!isSelectOnly(sql)) return { ok: false, output: "solo SELECT permitido" };
  for (const t of tablesUsed(sql)) {
    if (!READ_TABLES.has(t)) {
      return {
        ok: false,
        output: `tabla '${t}' no esta en la lista de lectura permitida (cotizador)`,
      };
    }
  }
  const r = await query(sql, params);
  const limited = r.rows.slice(0, 200);
  return { ok: true, output: JSON.stringify(limited, null, 2) };
}

async function hwRead(args: Record<string, unknown>) {
  const sql = typeof args.sql === "string" ? args.sql : "";
  const params = Array.isArray(args.params) ? (args.params as unknown[]) : [];
  if (!isSelectOnly(sql)) return { ok: false, output: "solo SELECT permitido" };
  for (const t of tablesUsed(sql)) {
    if (!HW_READ_TABLES.has(t)) {
      return { ok: false, output: `tabla '${t}' no permitida (HEI Work)` };
    }
  }
  const r = await query(sql, params);
  const limited = r.rows.slice(0, 200);
  return { ok: true, output: JSON.stringify(limited, null, 2) };
}

async function harrySend(args: Record<string, unknown>) {
  const channel = typeof args.channel === "string" ? args.channel : "";
  const to = typeof args.to === "string" ? args.to : "";
  const message = typeof args.message === "string" ? args.message : "";
  if (!channel || !to || !message) {
    return { ok: false, output: "channel, to, message son obligatorios" };
  }
  try {
    const r = await fetch(`${HARRY_URL}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(HARRY_TOKEN ? { Authorization: `Bearer ${HARRY_TOKEN}` } : {}),
      },
      body: JSON.stringify({ channel, to, message }),
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, output: `harry HTTP ${r.status}: ${text.slice(0, 300)}` };
    return { ok: true, output: `enviado: ${text.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, output: `harry error: ${(err as Error).message}` };
  }
}

async function memoryWrite(agentId: number, args: Record<string, unknown>) {
  const key = typeof args.key === "string" ? args.key : "";
  const value = typeof args.value === "string" ? args.value : "";
  const context = typeof args.context === "string" ? args.context : null;
  if (!key || !value) return { ok: false, output: "key y value son obligatorios" };
  await query(
    `INSERT INTO hei_work_agent_memory (agent_id, key, value, context)
     VALUES ($1, $2, $3, $4)`,
    [agentId, key, value, context],
  );
  return { ok: true, output: "memoria guardada" };
}
