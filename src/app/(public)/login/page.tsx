import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";

type SearchParams = Promise<{ error?: string; callbackUrl?: string }>;

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/board");

  await signIn("credentials", {
    email,
    password,
    redirectTo: callbackUrl,
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user) redirect("/board");

  const { error, callbackUrl } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] text-[var(--fg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">HEI Work</h1>
          <p className="text-sm text-[var(--fg-secondary)] mt-2">
            Tablero compartido humanos + agentes
          </p>
        </div>

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/board"} />

          <label className="block">
            <span className="text-sm text-[var(--fg-secondary)]">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm text-[var(--fg-secondary)]">Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>

          {error && (
            <p className="text-sm text-red-400">
              No pudimos autenticar. Revisa email y password.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110 transition"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
