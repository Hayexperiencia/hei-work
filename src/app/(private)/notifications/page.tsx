import NotificationsClient from "./NotificationsClient";
import { auth } from "@/lib/auth";
import { listNotifications } from "@/lib/queries/notifications";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const memberId = session.user.memberId;
  const notifications = await listNotifications(memberId, { limit: 100 });

  return <NotificationsClient initial={notifications} />;
}
