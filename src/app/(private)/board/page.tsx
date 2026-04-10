import KanbanBoard from "./components/KanbanBoard";
import { listMembers, listProjects } from "@/lib/queries/members";
import { listStatuses } from "@/lib/queries/statuses";
import { listTasks, type ListTasksOpts } from "@/lib/queries/tasks";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    assignee?: string;
    tags?: string;
    due_from?: string;
    due_to?: string;
    created_from?: string;
    created_to?: string;
  }>;
}) {
  const params = await searchParams;

  const opts: ListTasksOpts = { workspaceId: 1 };
  if (params.project) opts.projectId = Number(params.project);
  if (params.assignee === "unassigned") opts.assigneeId = "unassigned";
  else if (params.assignee) opts.assigneeId = Number(params.assignee);
  if (params.tags) opts.tags = params.tags.split(",").filter(Boolean);
  if (params.due_from) opts.dueFrom = params.due_from;
  if (params.due_to) opts.dueTo = params.due_to;
  if (params.created_from) opts.createdFrom = params.created_from;
  if (params.created_to) opts.createdTo = params.created_to;

  const [projects, members, tasks, statuses] = await Promise.all([
    listProjects(1),
    listMembers(1),
    listTasks(opts),
    listStatuses(1),
  ]);

  return (
    <KanbanBoard
      initialTasks={tasks}
      projects={projects}
      members={members}
      statuses={statuses}
      filters={{
        project: params.project ? Number(params.project) : null,
        assignee: params.assignee ?? null,
        tags: params.tags ? params.tags.split(",").filter(Boolean) : [],
        dueFrom: params.due_from ?? "",
        dueTo: params.due_to ?? "",
        createdFrom: params.created_from ?? "",
        createdTo: params.created_to ?? "",
      }}
    />
  );
}
