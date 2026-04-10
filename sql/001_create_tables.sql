-- HEI Work — schema MVP (Sprint 1)
-- Idempotente: se puede correr multiples veces sin efectos secundarios.
-- Todas las tablas con prefijo hei_work_ para aislarlas del cotizador.

BEGIN;

-- 1. workspaces
CREATE TABLE IF NOT EXISTS hei_work_workspaces (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. members (humanos y agentes)
CREATE TABLE IF NOT EXISTS hei_work_members (
  id            SERIAL PRIMARY KEY,
  workspace_id  INT NOT NULL REFERENCES hei_work_workspaces(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(200),
  type          VARCHAR(10) NOT NULL CHECK (type IN ('human','agent')),
  role          VARCHAR(50),
  avatar_url    TEXT,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  password_hash VARCHAR(200),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hei_work_members_email
  ON hei_work_members (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hei_work_members_workspace
  ON hei_work_members (workspace_id);

-- 3. projects (NO confundir con hei_projects del cotizador)
CREATE TABLE IF NOT EXISTS hei_work_projects (
  id                   SERIAL PRIMARY KEY,
  workspace_id         INT NOT NULL REFERENCES hei_work_workspaces(id) ON DELETE CASCADE,
  name                 VARCHAR(200) NOT NULL,
  description          TEXT,
  color                VARCHAR(7) NOT NULL DEFAULT '#ffcd07',
  status               VARCHAR(20) NOT NULL DEFAULT 'active',
  linked_cotizador_id  INT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_projects_workspace
  ON hei_work_projects (workspace_id);

-- 4. tasks
CREATE TABLE IF NOT EXISTS hei_work_tasks (
  id            SERIAL PRIMARY KEY,
  project_id    INT NOT NULL REFERENCES hei_work_projects(id) ON DELETE CASCADE,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'backlog',
  priority      VARCHAR(10) NOT NULL DEFAULT 'medium',
  assignee_id   INT REFERENCES hei_work_members(id) ON DELETE SET NULL,
  due_date      DATE,
  labels        TEXT[] NOT NULL DEFAULT '{}',
  sort_order    INT NOT NULL DEFAULT 0,
  task_type     VARCHAR(30),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by    INT REFERENCES hei_work_members(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hei_work_tasks_status
  ON hei_work_tasks (status);
CREATE INDEX IF NOT EXISTS idx_hei_work_tasks_assignee
  ON hei_work_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_hei_work_tasks_project
  ON hei_work_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_hei_work_tasks_due_date
  ON hei_work_tasks (due_date) WHERE due_date IS NOT NULL;

-- 5. comments
CREATE TABLE IF NOT EXISTS hei_work_comments (
  id          SERIAL PRIMARY KEY,
  task_id     INT NOT NULL REFERENCES hei_work_tasks(id) ON DELETE CASCADE,
  author_id   INT REFERENCES hei_work_members(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_comments_task
  ON hei_work_comments (task_id);

-- 6. agent_actions (audit log)
CREATE TABLE IF NOT EXISTS hei_work_agent_actions (
  id            SERIAL PRIMARY KEY,
  agent_id      INT NOT NULL REFERENCES hei_work_members(id) ON DELETE CASCADE,
  task_id       INT REFERENCES hei_work_tasks(id) ON DELETE SET NULL,
  action_type   VARCHAR(50) NOT NULL,
  input         JSONB NOT NULL DEFAULT '{}'::jsonb,
  output        JSONB NOT NULL DEFAULT '{}'::jsonb,
  tokens_used   INT NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(8,4) NOT NULL DEFAULT 0,
  duration_ms   INT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  error         TEXT,
  approved_by   INT REFERENCES hei_work_members(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hei_work_agent_actions_agent
  ON hei_work_agent_actions (agent_id);
CREATE INDEX IF NOT EXISTS idx_hei_work_agent_actions_task
  ON hei_work_agent_actions (task_id);
CREATE INDEX IF NOT EXISTS idx_hei_work_agent_actions_status
  ON hei_work_agent_actions (status);

-- 7. agent_memory
CREATE TABLE IF NOT EXISTS hei_work_agent_memory (
  id          SERIAL PRIMARY KEY,
  agent_id    INT NOT NULL REFERENCES hei_work_members(id) ON DELETE CASCADE,
  key         VARCHAR(200) NOT NULL,
  value       TEXT NOT NULL,
  context     VARCHAR(200),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_agent_memory_agent_key
  ON hei_work_agent_memory (agent_id, key);

-- 8. webhooks_log
CREATE TABLE IF NOT EXISTS hei_work_webhooks_log (
  id              SERIAL PRIMARY KEY,
  source          VARCHAR(30) NOT NULL,
  event_type      VARCHAR(100),
  payload         JSONB NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT false,
  task_created_id INT REFERENCES hei_work_tasks(id) ON DELETE SET NULL,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_webhooks_log_source
  ON hei_work_webhooks_log (source);
CREATE INDEX IF NOT EXISTS idx_hei_work_webhooks_log_processed
  ON hei_work_webhooks_log (processed) WHERE processed = false;

COMMIT;
