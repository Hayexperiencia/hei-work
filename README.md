# HEI Work

Sistema de project management donde humanos y agentes IA trabajan juntos como iguales. Capa de ejecucion del HayExperiencia OS.

- Dominio objetivo: `hei-work.hayexperiencia.com`
- Puerto: `3002`
- Stack: Next.js 16 + TypeScript + Tailwind v4 + PostgreSQL 17 + NextAuth + Worker Node + node-cron
- LLM: CLIProxyAPI (Claude Max + Gemini, costo $0)

## Documentacion

La fuente de verdad vive en el vault de Obsidian del operador (no en este repo):

- `HayExperiencia OS/HEI Work/HEI Work.md` — overview
- `HayExperiencia OS/HEI Work/Arquitectura HEI Work.md`
- `HayExperiencia OS/HEI Work/Esquema BD HEI Work.md`
- `HayExperiencia OS/HEI Work/Sprints/Sprint 1 - Cimientos.md` (a Sprint 4)
- `HayExperiencia OS/HEI Work/Runbooks/Ejecucion con Claude Code.md`

## Estructura

```
hei-work/
  CLAUDE.md                  reglas de seguridad para Claude Code
  sql/                       migraciones idempotentes
    001_create_tables.sql
    002_seed_initial_data.sql
  src/
    app/                     App Router (web + API)
    lib/                     db pool, auth, types
    worker/                  proceso separado con node-cron
    components/ui/
  Dockerfile                 multi-stage, web + worker en un container
```

## Comandos

```bash
npm install
npm run dev          # next dev en :3002
npm run build        # next build + tsc del worker
npm start            # node dist/worker/index.js & next start -p 3002
```

## Reglas de seguridad

Ver [`CLAUDE.md`](./CLAUDE.md). Resumen: este repo se construye con `--dangerously-skip-permissions`. Las reglas son el perimetro para no romper hayexperiencia.com, cotizador, ni Harry, que comparten el mismo VPS.
