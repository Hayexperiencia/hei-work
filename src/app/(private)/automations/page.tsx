import { query } from "@/lib/db";

import AutomationsClient from "./AutomationsClient";

export const dynamic = "force-dynamic";

interface RuleRow {
  id: number;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  last_fired_at: string | null;
  fire_count: number;
}

export default async function AutomationsPage() {
  const r = await query<RuleRow>(
    `SELECT id, name, description, trigger_type, trigger_config,
            action_type, action_config, is_active, last_fired_at, fire_count
       FROM hei_work_automation_rules
      WHERE workspace_id = 1
      ORDER BY id`,
  );
  return <AutomationsClient initial={r.rows} />;
}
