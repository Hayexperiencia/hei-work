import TeamClient from "./TeamClient";
import { listMembers } from "@/lib/queries/members";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const members = await listMembers(1);
  // strip password_hash
  const safe = members.map(({ password_hash: _ph, ...rest }) => rest);
  return <TeamClient initial={safe} />;
}
