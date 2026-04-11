-- HEI Work — migracion 005
-- 1) hei_work_automation_rules: triggers + acciones (sprint 3)
-- 2) Asegurar que hei_work_members.config tiene defaults usables para SOULs

BEGIN;

CREATE TABLE IF NOT EXISTS hei_work_automation_rules (
  id            SERIAL PRIMARY KEY,
  workspace_id  INT NOT NULL REFERENCES hei_work_workspaces(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  trigger_type  VARCHAR(50) NOT NULL,    -- webhook_ghl, webhook_wasi, cron, task_created, comment_created
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type   VARCHAR(50) NOT NULL,    -- create_task, assign_to, notify_harry, run_agent
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  fire_count    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hei_work_automation_rules_active
  ON hei_work_automation_rules (workspace_id, is_active);

-- Seed: regla por defecto webhook GHL -> @Nurture
INSERT INTO hei_work_automation_rules
  (workspace_id, name, description, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 1,
       'Lead nuevo de cotizador → @Nurture',
       'Cuando llega un ContactCreate de GHL con tag cotizador-web, crea una tarea para @Nurture con prioridad high',
       'webhook_ghl',
       '{"event_type":"ContactCreate","required_tag":"cotizador-web"}'::jsonb,
       'create_task',
       '{"assignee_name":"@Nurture","priority":"high","title_template":"Contactar lead: {name}","task_type":"nurture"}'::jsonb,
       true
WHERE NOT EXISTS (
  SELECT 1 FROM hei_work_automation_rules
   WHERE workspace_id = 1 AND name = 'Lead nuevo de cotizador → @Nurture'
);

COMMIT;
