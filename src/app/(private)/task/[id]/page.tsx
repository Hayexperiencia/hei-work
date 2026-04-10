import Link from "next/link";
import { notFound } from "next/navigation";

import { listCommentsByTask } from "@/lib/queries/comments";
import { listMembers } from "@/lib/queries/members";
import { getTask } from "@/lib/queries/tasks";

import TaskDetail from "./components/TaskDetail";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) notFound();

  const [task, comments, members] = await Promise.all([
    getTask(taskId),
    listCommentsByTask(taskId),
    listMembers(1),
  ]);

  if (!task) notFound();

  return (
    <div className="min-h-screen">
      <div className="border-b border-neutral-800 px-6 py-4">
        <Link
          href="/board"
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          ← Board
        </Link>
      </div>
      <TaskDetail initialTask={task} initialComments={comments} members={members} />
    </div>
  );
}
