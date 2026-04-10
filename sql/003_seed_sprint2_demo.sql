-- HEI Work — seed demo del Sprint 2
-- Inserta 12 tareas iniciales realistas para que Gabriel pueda interactuar
-- desde el dia 1 sin tener que crearlas a mano. Idempotente: usa NOT EXISTS por title+project.

BEGIN;

-- Resolver IDs por nombre (no asumimos serial fijo)
DO $$
DECLARE
  v_gabriel    INT;
  v_invest     INT;
  v_nurture    INT;
  v_analytics  INT;
  v_aluna      INT;
  v_faro       INT;
  v_aqua       INT;
  v_os         INT;
BEGIN
  SELECT id INTO v_gabriel   FROM hei_work_members  WHERE workspace_id=1 AND LOWER(email)='gabriel@hayexperiencia.com';
  SELECT id INTO v_invest    FROM hei_work_members  WHERE workspace_id=1 AND name='@Investigador';
  SELECT id INTO v_nurture   FROM hei_work_members  WHERE workspace_id=1 AND name='@Nurture';
  SELECT id INTO v_analytics FROM hei_work_members  WHERE workspace_id=1 AND name='@Analytics';

  SELECT id INTO v_os    FROM hei_work_projects WHERE workspace_id=1 AND name='HEI OS';
  SELECT id INTO v_aluna FROM hei_work_projects WHERE workspace_id=1 AND name='Ventas ALUNA';
  SELECT id INTO v_faro  FROM hei_work_projects WHERE workspace_id=1 AND name='Ventas El Faro';
  SELECT id INTO v_aqua  FROM hei_work_projects WHERE workspace_id=1 AND name='Ventas Aquaverde';

  -- ALUNA
  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_aluna,
         'Cerrar lote 7 con cliente Vargas',
         'Cliente listo, falta firma de promesa de compraventa. Coordinar con Cazatasa para credito.',
         'in_progress','urgent', v_gabriel,'manual', v_gabriel, 1
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_aluna AND title='Cerrar lote 7 con cliente Vargas');

  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_aluna,
         'Actualizar precios ALUNA segun valorizacion Q2',
         'Ajustar precios en cotizador y revisar contrato modelo. Subida 3% por valorizacion.',
         'backlog','high', v_gabriel,'manual', v_gabriel, 1
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_aluna AND title='Actualizar precios ALUNA segun valorizacion Q2');

  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_aluna,
         'Investigar precios de lotes premium en Rionegro',
         'Necesito comparables actualizados para defender precio ALUNA con clientes.',
         'backlog','medium', v_invest,'research', v_gabriel, 2
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_aluna AND title='Investigar precios de lotes premium en Rionegro');

  -- El Faro
  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_faro,
         'Levantamiento topografico zona muelle',
         'Coordinar visita con topografo, presupuesto pendiente. Foco para arranque ventas Q3.',
         'review','high', v_gabriel,'manual', v_gabriel, 1
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_faro AND title='Levantamiento topografico zona muelle');

  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_faro,
         'Render final del muelle nautico',
         'Brief enviado al estudio. Seguimiento esta semana, entrega prometida lunes.',
         'in_progress','high', v_gabriel,'manual', v_gabriel, 2
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_faro AND title='Render final del muelle nautico');

  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_faro,
         'Nurture campana El Faro - leads Q1',
         '40 leads de Q1 sin segundo touchpoint. Plan de re-engagement con 3 mensajes.',
         'backlog','medium', v_nurture,'nurture', v_gabriel, 3
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_faro AND title='Nurture campana El Faro - leads Q1');

  -- Aquaverde
  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_aqua,
         'Subir cover y galeria a Aquaverde en cotizador',
         'Faltan 4 fotos hero. Yesica las tiene listas, solo subirlas al admin.',
         'backlog','high', v_gabriel,'manual', v_gabriel, 1
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_aqua AND title='Subir cover y galeria a Aquaverde en cotizador');

  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_aqua,
         'Llamadas a leads Aquaverde de la semana',
         '8 leads nuevos de Meta Ads, llamada en menos de 2 horas.',
         'in_progress','high', v_nurture,'nurture', v_gabriel, 1
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_aqua AND title='Llamadas a leads Aquaverde de la semana');

  -- HEI OS / infraestructura
  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_os,
         'Sprint 2 HEI Work - Kanban + tareas + comentarios',
         'Implementar HW-01 a HW-09. Documentar bitacora en vault.',
         'in_progress','high', v_gabriel,'manual', v_gabriel, 1
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_os AND title='Sprint 2 HEI Work - Kanban + tareas + comentarios');

  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_os,
         'Bindear Harry a 0.0.0.0 + UFW desde Docker',
         'Mismo tratamiento que CLIProxy. Hacer antes de Sprint 3 (cuando agentes empiecen a notificar).',
         'backlog','medium', v_gabriel,'manual', v_gabriel, 2
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_os AND title='Bindear Harry a 0.0.0.0 + UFW desde Docker');

  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order)
  SELECT v_os,
         'Resumen semanal del negocio',
         'Generar reporte cada lunes 7am: ventas, leads, agentes activos, presupuesto.',
         'backlog','low', v_analytics,'analysis', v_gabriel, 3
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_os AND title='Resumen semanal del negocio');

  -- Una completada para que el board no se vea vacio en la columna Hecho
  INSERT INTO hei_work_tasks (project_id, title, description, status, priority, assignee_id, task_type, created_by, sort_order, completed_at)
  SELECT v_os,
         'Sprint 1 HEI Work - desplegado en produccion',
         'Cimientos: repo, DB, auth, healthcheck, Dockerfile, deploy en Coolify.',
         'done','high', v_gabriel,'manual', v_gabriel, 1, NOW()
  WHERE NOT EXISTS (SELECT 1 FROM hei_work_tasks WHERE project_id=v_os AND title='Sprint 1 HEI Work - desplegado en produccion');

END $$;

COMMIT;
