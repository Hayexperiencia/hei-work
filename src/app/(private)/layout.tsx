import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";

import NotificationBell from "./components/NotificationBell";
import ThemeToggle from "./components/ThemeToggle";

const NAV = [
  { href: "/board", label: "Board", icon: "📋" },
  { href: "/projects", label: "Proyectos", icon: "🗂️" },
  { href: "/team", label: "Equipo", icon: "👥" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
];

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--fg-primary)]">
      <aside className="hidden md:flex md:flex-col w-56 flex-shrink-0 border-r border-[var(--border-base)] bg-[var(--bg-elevated)]">
        <div className="px-5 py-6">
          <div className="text-lg font-semibold tracking-tight">
            HEI <span className="text-[var(--accent)]">Work</span>
          </div>
          <div className="text-xs text-[var(--fg-muted)] mt-1">
            {session.user.name ?? session.user.email}
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <NotificationBell />
        </nav>

        <div className="border-t border-[var(--border-base)] p-2 space-y-0.5">
          <ThemeToggle />
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left rounded-md px-3 py-2 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
            >
              Salir
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
