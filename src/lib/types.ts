// Tipos espejo de las tablas hei_work_*
// Mantener sincronizado manualmente con sql/001_create_tables.sql

export type MemberType = "human" | "agent";

// TaskStatus es ahora dinamico (string libre) — los estados validos viven en hei_work_statuses
export type TaskStatus = string;
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "active" | "archived";

export type AgentActionStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "budget_exceeded"
  | "needs_approval";

export interface Workspace {
  id: number;
  name: string;
  config: Record<string, unknown>;
  created_at: string;
}

export interface Member {
  id: number;
  workspace_id: number;
  name: string;
  email: string | null;
  type: MemberType;
  role: string | null;
  avatar_url: string | null;
  config: Record<string, unknown>;
  password_hash: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  workspace_id: number;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  linked_cotizador_id: number | null;
  created_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: number | null;
  due_date: string | null;
  labels: string[];
  sort_order: number;
  task_type: string | null;
  metadata: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Comment {
  id: number;
  task_id: number;
  author_id: number | null;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentAction {
  id: number;
  agent_id: number;
  task_id: number | null;
  action_type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  tokens_used: number;
  cost_usd: string;
  duration_ms: number | null;
  status: AgentActionStatus;
  error: string | null;
  approved_by: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface AgentMemory {
  id: number;
  agent_id: number;
  key: string;
  value: string;
  context: string | null;
  expires_at: string | null;
  created_at: string;
}

export type MissionOutputStrategy =
  | "comment"
  | "new_task"
  | "vault_note"
  | "harry_send"
  | "multi";

export interface AgentMission {
  id: number;
  agent_id: number;
  name: string;
  description: string | null;
  instructions: string;
  schedule: string | null;
  output_strategy: MissionOutputStrategy;
  output_config: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_action_id: number | null;
  fire_count: number;
  created_at: string;
}

export type MetricType = "number" | "percentage" | "currency" | "boolean";
export type ObjectiveStatus = "active" | "achieved" | "abandoned";

export interface Objective {
  id: number;
  workspace_id: number;
  title: string;
  description: string | null;
  period: string;
  status: ObjectiveStatus;
  progress: number;
  owner_id: number | null;
  color: string;
  created_at: string;
}

export interface KeyResult {
  id: number;
  objective_id: number;
  title: string;
  metric_type: MetricType;
  current_value: number;
  target_value: number;
  start_value: number;
  unit: string | null;
  auto_source: string | null;
  auto_source_args: Record<string, unknown>;
  last_updated_at: string | null;
  position: number;
  created_at: string;
}

export interface WorkflowStatus {
  id: number;
  workspace_id: number;
  key: string;
  label: string;
  color: string;
  position: number;
  is_default: boolean;
  is_terminal: boolean;
  created_at: string;
}

export type NotificationType =
  | "mention"
  | "assigned"
  | "comment_on_my_task"
  | "task_status_changed";

export interface Notification {
  id: number;
  recipient_id: number;
  actor_id: number | null;
  type: NotificationType;
  task_id: number | null;
  comment_id: number | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface WebhookLog {
  id: number;
  source: string;
  event_type: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  task_created_id: number | null;
  error: string | null;
  created_at: string;
}
