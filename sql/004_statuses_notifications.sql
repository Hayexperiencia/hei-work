-- HEI Work — migracion 004
-- 1) hei_work_statuses: estados de tarea customizables por workspace
-- 2) hei_work_notifications: bandeja de menciones y eventos del usuario
--
-- Idempotente. Tasks.status sigue siendo VARCHAR libre — relacionado por 'key'.
-- Esto deja al usuario renombrar (label) sin migrar datos, y crear nuevos states sin DDL.

BEGIN;

-- ===== STATUSES =====
CREATE TABLE IF NOT EXISTS hei_work_statuses (
  id            SERIAL PRIMARY KEY,
  workspace_id  INT NOT NULL REFERENCES hei_work_workspaces(id) ON DELETE CASCADE,
  key           VARCHAR(50) NOT NULL,
  label         VARCHAR(100) NOT NULL,
  color         VARCHAR(7) NOT NULL DEFAULT '#a0a0a0',
  position      INT NOT NULL DEFAULT 0,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  is_terminal   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hei_work_statuses_ws_key
  ON hei_work_statuses (workspace_id, key);
CREATE INDEX IF NOT EXISTS idx_hei_work_statuses_workspace
  ON hei_work_statuses (workspace_id, position);

-- Seed de los 4 estados por defecto
INSERT INTO hei_work_statuses (workspace_id, key, label, color, position, is_default, is_terminal)
SELECT 1, v.key, v.label, v.color, v.position, v.is_default, v.is_terminal
FROM (VALUES
  ('backlog',     'Backlog',     '#a0a0a0', 0, true,  false),
  ('in_progress', 'En progreso', '#3b82f6', 1, false, false),
  ('review',      'Revision',    '#f59e0b', 2, false, false),
  ('done',        'Hecho',       '#10b981', 3, false, true)
) AS v(key, label, color, position, is_default, is_terminal)
WHERE NOT EXISTS (
  SELECT 1 FROM hei_work_statuses s
  WHERE s.workspace_id = 1 AND s.key = v.key
);

-- ===== NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS hei_work_notifications (
  id          SERIAL PRIMARY KEY,
  recipient_id INT NOT NULL REFERENCES hei_work_members(id) ON DELETE CASCADE,
  actor_id    INT REFERENCES hei_work_members(id) ON DELETE SET NULL,
  type        VARCHAR(40) NOT NULL,
  task_id     INT REFERENCES hei_work_tasks(id) ON DELETE CASCADE,
  comment_id  INT REFERENCES hei_work_comments(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_notifications_recipient_unread
  ON hei_work_notifications (recipient_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hei_work_notifications_recipient_all
  ON hei_work_notifications (recipient_id, created_at DESC);

COMMIT;
