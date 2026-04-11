import { TOOL_DEFS } from "@/lib/agents/tools";
import { query } from "@/lib/db";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  agents: Array<{ id: number; name: string }>;
  example_input: string;
  example_output: string;
}

const EXAMPLES: Record<string, { input: string; output: string }> = {
  vault_read: {
    input: `{"path": "HayExperiencia OS/HEI Work/HEI Work.md"}`,
    output: "Contenido del .md (hasta 200 KB). El agente lo usa como contexto.",
  },
  vault_list: {
    input: `{"path": "HayExperiencia OS/HEI Work"}`,
    output: `[dir] Agentes\n[file] HEI Work.md\n[file] Arquitectura HEI Work.md\n...`,
  },
  db_read: {
    input: `{"sql": "SELECT name, status FROM hei_projects WHERE status='preventa'", "params": []}`,
    output: `[\n  {"name":"ALUNA Campestre","status":"preventa"},\n  ...\n]`,
  },
  hw_read: {
    input: `{"sql": "SELECT COUNT(*)::int AS c FROM hei_work_tasks WHERE status='done' AND completed_at >= date_trunc('month', NOW())"}`,
    output: `[{"c": 7}]`,
  },
  harry_send: {
    input: `{"channel":"telegram","to":"<chat_id_gabriel>","message":"**Resumen:** ventas sem X"}`,
    output: `{"enviado": true, "message_id": "..."}`,
  },
  agent_memory_write: {
    input: `{"key":"horario_pico_respuesta_aluna","value":"19:00-21:00 Colombia es el pico","context":"ALUNA"}`,
    output: `memoria guardada`,
  },
};

const CATEGORY: Record<string, { icon: string; color: string; label: string }> = {
  vault_read: { icon: "📖", color: "#3b82f6", label: "Vault — lectura" },
  vault_list: { icon: "📂", color: "#3b82f6", label: "Vault — listado" },
  db_read: { icon: "🗄️", color: "#10b981", label: "DB — cotizador" },
  hw_read: { icon: "📊", color: "#10b981", label: "DB — HEI Work" },
  harry_send: { icon: "📨", color: "#ec4899", label: "Harry — envio" },
  agent_memory_write: { icon: "🧠", color: "#8b5cf6", label: "Memoria agente" },
};

export default async function ToolsPage() {
  // Load agents and their tools config
  const r = await query<Member>(
    `SELECT * FROM hei_work_members
      WHERE workspace_id = 1 AND type = 'agent' AND is_active = true
      ORDER BY id`,
  );
  const agents = r.rows;

  const tools: ToolInfo[] = Object.entries(TOOL_DEFS).map(([name, def]) => {
    const usedBy = agents
      .filter((a) => {
        const cfg = a.config as { tools?: string[] };
        return Array.isArray(cfg?.tools) && cfg.tools.includes(name);
      })
      .map((a) => ({ id: a.id, name: a.name }));
    const ex = EXAMPLES[name] ?? { input: "{}", output: "..." };
    return {
      name,
      description: def.function.description,
      parameters: def.function.parameters,
      agents: usedBy,
      example_input: ex.input,
      example_output: ex.output,
    };
  });

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-semibold">Tools & Skills</h1>
        <p className="text-xs text-[var(--fg-muted)] mt-1">
          Capacidades disponibles para los agentes IA. Cada tool es una funcion que Claude puede
          invocar durante una ejecucion. Las skills (misiones recurrentes) se configuran en cada
          agente.
        </p>
      </div>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-3">
          Tools registradas ({tools.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => {
            const cat = CATEGORY[t.name] ?? { icon: "🔧", color: "#a0a0a0", label: "" };
            return (
              <div
                key={t.name}
                className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl" aria-hidden>
                    {cat.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-[var(--fg-primary)]">{t.name}</div>
                    <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
                      {cat.label}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--fg-secondary)] leading-snug">
                  {t.description}
                </p>
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
                    Usada por
                  </div>
                  {t.agents.length === 0 ? (
                    <div className="mt-1 text-[10px] text-[var(--fg-muted)]">
                      ningun agente
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.agents.map((a) => (
                        <span
                          key={a.id}
                          className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300"
                        >
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-[10px] uppercase text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]">
                    Ejemplo
                  </summary>
                  <div className="mt-2 space-y-1">
                    <div className="text-[9px] uppercase text-[var(--fg-muted)]">input</div>
                    <pre className="overflow-x-auto rounded bg-[var(--bg-input)] p-2 text-[10px] font-mono text-[var(--fg-secondary)]">
                      {t.example_input}
                    </pre>
                    <div className="text-[9px] uppercase text-[var(--fg-muted)]">output</div>
                    <pre className="overflow-x-auto rounded bg-[var(--bg-input)] p-2 text-[10px] font-mono text-[var(--fg-secondary)]">
                      {t.example_output}
                    </pre>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4">
        <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2">
          Como habilitar o deshabilitar tools en un agente
        </h2>
        <p className="text-xs text-[var(--fg-secondary)]">
          Entra a <span className="font-mono text-[var(--accent)]">/agents/[id]</span> (click en un
          agente desde la pagina de Equipo), y marca o desmarca la tool en la seccion{" "}
          <em>Tools habilitadas</em>. Los cambios aplican al proximo tick del scheduler (maximo 60
          segundos).
        </p>
        <p className="text-xs text-[var(--fg-secondary)] mt-2">
          Para agregar una tool nueva al sistema hay que editar el codigo (
          <span className="font-mono">src/lib/agents/tools.ts</span> y{" "}
          <span className="font-mono">src/worker/tools.ts</span>), definir el JSONSchema, la
          implementacion y los guards de seguridad. Un flujo para subir tools custom como skills
          empaquetadas es parte del roadmap.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-4">
        <h2 className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2">
          Skills (misiones recurrentes)
        </h2>
        <p className="text-xs text-[var(--fg-secondary)]">
          Una skill en HEI Work es una <strong>mision</strong>: un trabajo recurrente que un
          agente ejecuta automaticamente en su schedule. Cada mision tiene un nombre, instrucciones
          (prompt), cron propio y una estrategia de output (comentario en tarea fija, crear tarea
          nueva, escribir nota en el vault, enviar via Harry).
        </p>
        <p className="text-xs text-[var(--fg-secondary)] mt-2">
          Para ver, crear o editar misiones: entra a un agente en{" "}
          <span className="font-mono text-[var(--accent)]">/agents/[id]</span> y usa la seccion{" "}
          <em>Misiones</em>.
        </p>
      </section>
    </div>
  );
}
