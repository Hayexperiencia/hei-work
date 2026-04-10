import ProjectsClient from "./ProjectsClient";
import { listProjects } from "@/lib/queries/members";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, taskCounts] = await Promise.all([
    listProjects(1),
    query<{ project_id: number; cnt: number }>(
      `SELECT project_id, COUNT(*)::int AS cnt
         FROM hei_work_tasks GROUP BY project_id`,
    ),
  ]);
  const counts: Record<number, number> = {};
  for (const r of taskCounts.rows) counts[r.project_id] = r.cnt;
  return <ProjectsClient initial={projects} taskCounts={counts} />;
}
