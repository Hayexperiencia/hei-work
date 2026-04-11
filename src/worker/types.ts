// Tipos del worker (espejo simplificado de los de la web)

export interface AgentRow {
  id: number;
  name: string;
  type: "human" | "agent";
  role: string | null;
  config: AgentConfig;
  is_active: boolean;
}

export interface AgentConfig {
  soul?: string;
  soul_text?: string;
  model?: string;
  temperature?: number;
  schedule?: string;
  budget_tokens_per_run?: number;
  budget_tokens_per_month?: number;
  tools?: string[];
  permissions?: AgentPermissions;
}

export interface AgentPermissions {
  can_create_tasks?: boolean;
  can_close_tasks?: boolean;
  can_notify_humans?: boolean;
  can_call_external_apis?: boolean;
}

export interface TaskRow {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: number | null;
  due_date: string | null;
  labels: string[];
  task_type: string | null;
  metadata: Record<string, unknown>;
  project_name?: string;
}

export interface CommentRow {
  id: number;
  task_id: number;
  author_id: number | null;
  body: string;
  created_at: string;
  author_name: string | null;
}
