@AGENTS.md

# HEI Work — Reglas para Claude Code

Este repo se construye con `claude --dangerously-skip-permissions`. Estas reglas son el perimetro de seguridad. NO negociables.

## Aislamiento del repo

1. Solo trabajar dentro de `/root/hei-work`. Nunca `cd` fuera.
2. Nunca tocar `/root/hayexperiencia-web`, `/root/assistant`, `/root/.openclaw`, `/data/coolify`.
3. Sin `git push --force`. Sin `rm -rf` excepto en `/root/hei-work/dist` o `/root/hei-work/.next`.

## Base de datos

4. Toda tabla nueva DEBE tener prefijo `hei_work_`.
5. SQL solo idempotente: `CREATE TABLE IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
6. Prohibido `DROP TABLE`, `TRUNCATE`, `DELETE FROM hei_*` sobre tablas del cotizador (`hei_projects`, `hei_inventory_units`, `hei_quotations`, `hei_project_stages`, `hei_system_config`, `hei_unit_type_images`).
7. Las tablas del cotizador son SOLO LECTURA desde HEI Work.
8. Conexion via `pg` (node-postgres). Queries siempre parametrizadas (`$1`, `$2`).

## Puertos y servicios

9. Puerto del web: **3002**. Prohibido 3000 (web), 3001 (PDF), 8317 (CLIProxy), 18789 (Harry).
10. Sin `systemctl` sobre servicios ajenos. Solo `hei-work` cuando exista.
11. Sin modificar `/etc/nginx/`, `/etc/traefik/`, `/etc/hosts`. Para dominios usar Coolify.
12. Sin cambiar credenciales de servicios existentes.

## Despliegue

13. Despues de cada deploy: `curl https://hayexperiencia.com`, `curl https://cotizador.hayexperiencia.com`, `curl http://localhost:18789/health` deben responder 200.
14. CLIProxyAPI vive en `http://localhost:8317` y es la unica via para LLMs (costo $0).
15. Harry vive en `http://localhost:18789` y se llama via HTTP para enviar mensajes.

## Codigo

16. Stack fijo: Next.js 16 App Router + TypeScript + Tailwind v4 + pg + NextAuth.
17. Sin Prisma, sin Drizzle, sin TypeORM. Solo `pg` con queries SQL.
18. Tipos manuales en `src/lib/types.ts` (espejo de las tablas).
19. Secretos solo en variables de entorno, nunca en repo.
20. Antes de cada cambio de schema, leer [[Esquema BD HEI Work]] en el vault del usuario.

## Workflow

21. Despues de cada paso significativo: `git add -A && git commit -m "..."`.
22. Mensajes de commit en espanol, modo imperativo, breves.
23. Documentar cada paso en `/root/obsidian-vault/HayExperiencia OS/HEI Work/Bitacoras/`.
24. Si algo no esta en la documentacion del vault, detenerse y reportar antes de improvisar.
