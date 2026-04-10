import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export interface ApiSession {
  memberId: number;
  role: string | null;
  email: string | null;
  name: string | null;
}

export async function requireSession(): Promise<
  | { ok: true; session: ApiSession }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user || typeof session.user.memberId !== "number" || session.user.memberId <= 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return {
    ok: true,
    session: {
      memberId: session.user.memberId,
      role: session.user.role ?? null,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
    },
  };
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json(
    { error: "bad_request", message, details },
    { status: 400 },
  );
}

export function notFound(message = "not_found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: "server_error", message }, { status: 500 });
}
