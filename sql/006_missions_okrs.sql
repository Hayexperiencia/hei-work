-- HEI Work — migracion 006 (Sprint 4)
-- 1) hei_work_agent_missions: trabajo recurrente de agentes con cron propio y output strategy
-- 2) hei_work_objectives + hei_work_key_results: OKRs con auto_source

BEGIN;

-- ============================================================
-- MISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS hei_work_agent_missions (
  id              SERIAL PRIMARY KEY,
  agent_id        INT NOT NULL REFERENCES hei_work_members(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  instructions    TEXT NOT NULL,
  schedule        VARCHAR(50),
  output_strategy VARCHAR(30) NOT NULL DEFAULT 'comment',
  output_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  last_run_status VARCHAR(20),
  last_run_action_id INT REFERENCES hei_work_agent_actions(id) ON DELETE SET NULL,
  fire_count      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_agent_missions_agent
  ON hei_work_agent_missions (agent_id);
CREATE INDEX IF NOT EXISTS idx_hei_work_agent_missions_active
  ON hei_work_agent_missions (is_active) WHERE is_active = true;

-- ============================================================
-- OBJECTIVES
-- ============================================================
CREATE TABLE IF NOT EXISTS hei_work_objectives (
  id            SERIAL PRIMARY KEY,
  workspace_id  INT NOT NULL REFERENCES hei_work_workspaces(id) ON DELETE CASCADE,
  title         VARCHAR(300) NOT NULL,
  description   TEXT,
  period        VARCHAR(30) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  progress      NUMERIC(5,2) NOT NULL DEFAULT 0,
  owner_id      INT REFERENCES hei_work_members(id) ON DELETE SET NULL,
  color         VARCHAR(7) NOT NULL DEFAULT '#ffcd07',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_objectives_workspace
  ON hei_work_objectives (workspace_id, status);

-- ============================================================
-- KEY RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hei_work_key_results (
  id              SERIAL PRIMARY KEY,
  objective_id    INT NOT NULL REFERENCES hei_work_objectives(id) ON DELETE CASCADE,
  title           VARCHAR(300) NOT NULL,
  metric_type     VARCHAR(20) NOT NULL DEFAULT 'number',
  current_value   NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_value    NUMERIC(14,2) NOT NULL,
  start_value     NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit            VARCHAR(20),
  auto_source     VARCHAR(100),
  auto_source_args JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_updated_at TIMESTAMPTZ,
  position        INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_key_results_objective
  ON hei_work_key_results (objective_id);
CREATE INDEX IF NOT EXISTS idx_hei_work_key_results_auto_source
  ON hei_work_key_results (auto_source) WHERE auto_source IS NOT NULL;

COMMIT;
