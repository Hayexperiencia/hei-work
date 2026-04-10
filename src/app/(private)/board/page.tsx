import KanbanBoard from "./components/KanbanBoard";
import { listProjects } from "@/lib/queries/members";
import { listMembers } from "@/lib/queries/members";
import { listTasks } from "@/lib/queries/tasks";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projectId = params.project ? Number(params.project) : undefined;

  const [projects, members, tasks] = await Promise.all([
    listProjects(1),
    listMembers(1),
    listTasks({
      workspaceId: 1,
      projectId: projectId && Number.isFinite(projectId) ? projectId : undefined,
    }),
  ]);

  return (
    <KanbanBoard
      initialTasks={tasks}
      projects={projects}
      members={members}
      selectedProjectId={projectId ?? null}
    />
  );
}
