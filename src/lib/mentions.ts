import { query } from "@/lib/db";
import type { Member } from "@/lib/types";

const MENTION_RE = /(?:^|\s)@([a-zA-ZÀ-ÿ0-9_.-]{2,40})/g;

export interface MentionMatch {
  raw: string;
  name: string;
  memberId: number | null;
}

/**
 * Detecta @menciones en un texto y resuelve a member_id.
 * - Match contra hei_work_members.name (case-insensitive, prefix tambien permitido).
 * - Soporta @Gabriel, @Yoko, @Investigador, @yoko_giraldo, etc.
 * - Si hay ambiguedad (varios names empiezan con la misma palabra), elige el match exacto.
 */
export async function parseMentions(
  text: string,
  workspaceId = 1,
): Promise<MentionMatch[]> {
  const matches: { raw: string; name: string }[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    const raw = m[0].trim();
    const name = m[1];
    if (name) matches.push({ raw, name });
  }
  if (matches.length === 0) return [];

  const uniqueNames = Array.from(new Set(matches.map((m) => m.name.toLowerCase())));

  // Buscar miembros por LOWER(name) coincidente o por prefijo
  const r = await query<Member>(
    `SELECT id, workspace_id, name, email, type, role, avatar_url, config,
            password_hash, is_active, created_at
       FROM hei_work_members
      WHERE workspace_id = $1
        AND is_active = true
        AND (
          LOWER(REPLACE(name, '@', '')) = ANY($2::text[])
          OR LOWER(REPLACE(name, '@', '')) LIKE ANY (
            SELECT n || '%' FROM unnest($2::text[]) AS n
          )
        )`,
    [workspaceId, uniqueNames],
  );

  // Indexar por nombre normalizado (sin @, lowercase)
  const byName = new Map<string, Member>();
  for (const m of r.rows) {
    const k = m.name.replace(/^@/, "").toLowerCase();
    if (!byName.has(k)) byName.set(k, m);
  }

  return matches.map((mt) => {
    const k = mt.name.toLowerCase();
    let member = byName.get(k);
    if (!member) {
      // Match por prefijo
      for (const [name, mem] of byName) {
        if (name.startsWith(k)) {
          member = mem;
          break;
        }
      }
    }
    return {
      raw: mt.raw,
      name: mt.name,
      memberId: member?.id ?? null,
    };
  });
}
