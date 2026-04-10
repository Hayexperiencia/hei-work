-- HEI Work — seed inicial (Sprint 1)
-- Idempotente. Usa name como llave logica para los placeholders.

BEGIN;

-- Workspace unico del MVP
INSERT INTO hei_work_workspaces (id, name, config) VALUES
  (1, 'HayExperiencia', '{"lang":"es","timezone":"America/Bogota"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Asegura que el sequence quede sincronizado despues del insert con id explicito
SELECT setval(
  pg_get_serial_sequence('hei_work_workspaces','id'),
  GREATEST((SELECT COALESCE(MAX(id),1) FROM hei_work_workspaces), 1)
);

-- Proyectos placeholder
INSERT INTO hei_work_projects (workspace_id, name, color)
SELECT 1, v.name, v.color
FROM (VALUES
  ('HEI OS',          '#ffcd07'),
  ('Ventas ALUNA',    '#10b981'),
  ('Ventas El Faro',  '#3b82f6'),
  ('Ventas Aquaverde','#06b6d4')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM hei_work_projects p
  WHERE p.workspace_id = 1 AND p.name = v.name
);

-- Gabriel (humano admin). El password_hash se actualiza despues con bcrypt real.
INSERT INTO hei_work_members (workspace_id, name, email, type, role, password_hash)
SELECT 1, 'Gabriel', 'gabriel@hayexperiencia.com', 'human', 'admin', '$2a$12$PLACEHOLDER'
WHERE NOT EXISTS (
  SELECT 1 FROM hei_work_members
  WHERE workspace_id = 1 AND LOWER(email) = 'gabriel@hayexperiencia.com'
);

-- Agentes placeholder (config completa viene en Sprint 3)
INSERT INTO hei_work_members (workspace_id, name, type, role, config)
SELECT 1, v.name, 'agent', v.role, v.config::jsonb
FROM (VALUES
  ('@Investigador', 'researcher', '{"soul":"souls/investigador.md","schedule":"0 2 * * *"}'),
  ('@Nurture',      'nurture',    '{"soul":"souls/nurture.md","schedule":"*/30 * * * *"}'),
  ('@Analytics',    'analytics',  '{"soul":"souls/analytics.md","schedule":"0 7 * * 1"}')
) AS v(name, role, config)
WHERE NOT EXISTS (
  SELECT 1 FROM hei_work_members m
  WHERE m.workspace_id = 1 AND m.name = v.name
);

COMMIT;
