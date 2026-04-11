// Tool runner — implementa las tools que pueden invocar los agentes
// Cada tool valida el subset permitido por el agente (tools en config).
import * as fs from "fs/promises";
import * as path from "path";

import { q } from "./db";
import { logger } from "./logger";
import type { ChatToolDef } from "./llm-client";

const log = logger("tools");

// === Definicion JSONSchema para el LLM ===

export const TOOL_DEFS: Record<string, ChatToolDef> = {
  vault_read: {
    type: "function",
    function: {
      name: "vault_read",
      description:
        "Lee un archivo markdown del vault de Obsidian (contexto del negocio). Path relativo a la raiz del vault, ej: 'HayExperiencia OS/HEI Work/HEI Work.md'.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "ruta relativa al vault (.md)",
          },
        },
        required: ["path"],
      },
    },
  },
  vault_list: {
    type: "function",
    function: {
      name: "vault_list",
      description:
        "Lista archivos y carpetas en una ruta del vault. Util para descubrir que documentos existen.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "ruta a listar (puede ser '')" },
        },
        required: ["path"],
      },
    },
  },
  db_read: {
    type: "function",
    function: {
      name: "db_read",
      description:
        "Ejecuta una consulta SELECT en la base de datos del cotizador. Solo SELECT, sin UPDATE/INSERT/DELETE. Tablas disponibles: hei_projects, hei_inventory_units, hei_quotations, hei_project_stages.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "consulta SELECT con parametros $1, $2, ...",
          },
          params: {
            type: "array",
            items: {},
            description: "parametros de la consulta (opcional)",
          },
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
        "Ejecuta una consulta SELECT en HEI Work. Tablas: hei_work_tasks, hei_work_projects, hei_work_members, hei_work_comments, hei_work_agent_actions, hei_work_agent_memory.",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "SELECT" },
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
        "Envia un mensaje a traves de Harry (Telegram/WhatsApp del CEO). Usar SOLO para notificaciones urgentes o reportes de Analytics.",
      parameters: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            enum: ["telegram", "whatsapp"],
            description: "canal de envio",
          },
          to: {
            type: "string",
            description: "destinatario (chat_id telegram o whatsapp number)",
          },
          message: {
            type: "string",
            description: "texto del mensaje (markdown soportado)",
          },
        },
        required: ["channel", "to", "message"],
      },
    },
  },
  agent_memory_write: {
    type: "function",
    function: {
      name: "agent_memory_write",
      description:
        "Guarda una memoria persistente del agente para usarla en futuras ejecuciones.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "slug del concepto" },
          value: { type: "string", description: "contenido libre" },
          context: { type: "string", description: "tema o proyecto opcional" },
        },
        required: ["key", "value"],
      },
    },
  },
};

// === Implementacion de cada tool ===

const VAULT_ROOT = process.env.VAULT_PATH ?? "/vault";
const HARRY_URL = process.env.HARRY_URL ?? "http://localhost:18789";
const HARRY_TOKEN = process.env.HARRY_TOKEN ?? "";

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
  if (forbidden.test(trimmed)) return false;
  return true;
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

export interface ToolContext {
  agentId: number;
  enabledTools: string[];
}

export async function runTool(
  ctx: ToolContext,
  name: string,
  argsRaw: string,
): Promise<{ ok: boolean; output: string; meta?: Record<string, unknown> }> {
  if (!ctx.enabledTools.includes(name)) {
    return {
      ok: false,
      output: `Tool '${name}' no esta habilitada para este agente.`,
    };
  }

  let args: Record<string, unknown> = {};
  try {
    args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
  } catch {
    return { ok: false, output: "argumentos invalidos (no JSON)" };
  }

  log.info(`tool ${name}`, { args });

  try {
    switch (name) {
      case "vault_read":
        return await toolVaultRead(args);
      case "vault_list":
        return await toolVaultList(args);
      case "db_read":
        return await toolDbRead(args);
      case "hw_read":
        return await toolHwRead(args);
      case "harry_send":
        return await toolHarrySend(args);
      case "agent_memory_write":
        return await toolMemoryWrite(ctx.agentId, args);
      default:
        return { ok: false, output: `tool desconocida: ${name}` };
    }
  } catch (err) {
    log.error(`tool ${name} fail`, { err: (err as Error).message });
    return { ok: false, output: `error: ${(err as Error).message}` };
  }
}

async function toolVaultRead(args: Record<string, unknown>) {
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
      return {
        ok: false,
        output: `archivo no encontrado o vault no montado en ${VAULT_ROOT}`,
      };
    }
    throw err;
  }
}

async function toolVaultList(args: Record<string, unknown>) {
  const rel = typeof args.path === "string" ? args.path : "";
  const full = safeJoin(VAULT_ROOT, rel);
  if (!full) return { ok: false, output: "path invalido" };
  try {
    const entries = await fs.readdir(full, { withFileTypes: true });
    const lines = entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => `${e.isDirectory() ? "[dir]" : "[file]"} ${e.name}`)
      .slice(0, 200);
    return { ok: true, output: lines.join("\n") || "(vacio)" };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, output: `path no encontrado en ${VAULT_ROOT}` };
    }
    throw err;
  }
}

async function toolDbRead(args: Record<string, unknown>) {
  const sql = typeof args.sql === "string" ? args.sql : "";
  const params = Array.isArray(args.params) ? (args.params as unknown[]) : [];
  if (!isSelectOnly(sql)) {
    return { ok: false, output: "solo SELECT permitido" };
  }
  const used = tablesUsed(sql);
  for (const t of used) {
    if (!READ_TABLES.has(t)) {
      return {
        ok: false,
        output: `tabla '${t}' no esta en la lista de lectura permitida (cotizador): ${[...READ_TABLES].join(", ")}`,
      };
    }
  }
  const r = await q(sql, params);
  const limited = r.rows.slice(0, 200);
  return {
    ok: true,
    output: JSON.stringify(limited, null, 2),
    meta: { rows: r.rowCount, returned: limited.length },
  };
}

async function toolHwRead(args: Record<string, unknown>) {
  const sql = typeof args.sql === "string" ? args.sql : "";
  const params = Array.isArray(args.params) ? (args.params as unknown[]) : [];
  if (!isSelectOnly(sql)) {
    return { ok: false, output: "solo SELECT permitido" };
  }
  const used = tablesUsed(sql);
  for (const t of used) {
    if (!HW_READ_TABLES.has(t)) {
      return {
        ok: false,
        output: `tabla '${t}' no permitida (HEI Work)`,
      };
    }
  }
  const r = await q(sql, params);
  const limited = r.rows.slice(0, 200);
  return {
    ok: true,
    output: JSON.stringify(limited, null, 2),
    meta: { rows: r.rowCount, returned: limited.length },
  };
}

async function toolHarrySend(args: Record<string, unknown>) {
  const channel = typeof args.channel === "string" ? args.channel : "";
  const to = typeof args.to === "string" ? args.to : "";
  const message = typeof args.message === "string" ? args.message : "";
  if (!channel || !to || !message) {
    return { ok: false, output: "channel, to, message son obligatorios" };
  }
  // El gateway de Harry expone /messages para envio. Si no existe el endpoint
  // o falla, capturamos y devolvemos error legible al agente.
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
    if (!r.ok) {
      return { ok: false, output: `harry HTTP ${r.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, output: `enviado: ${text.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, output: `harry error: ${(err as Error).message}` };
  }
}

async function toolMemoryWrite(agentId: number, args: Record<string, unknown>) {
  const key = typeof args.key === "string" ? args.key : "";
  const value = typeof args.value === "string" ? args.value : "";
  const context = typeof args.context === "string" ? args.context : null;
  if (!key || !value) return { ok: false, output: "key y value son obligatorios" };
  await q(
    `INSERT INTO hei_work_agent_memory (agent_id, key, value, context)
     VALUES ($1, $2, $3, $4)`,
    [agentId, key, value, context],
  );
  return { ok: true, output: "memoria guardada" };
}
