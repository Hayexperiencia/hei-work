import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";

import NotificationBell from "./components/NotificationBell";

const NAV = [
  { href: "/board", label: "Board" },
  { href: "/team", label: "Equipo" },
  { href: "/dashboard", label: "Dashboard" },
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
    <div className="flex min-h-screen">
      <aside className="hidden md:flex md:flex-col w-56 border-r border-neutral-800 bg-[#0a0a1a]">
        <div className="px-5 py-6">
          <div className="text-lg font-semibold tracking-tight">
            HEI <span className="text-[#ffcd07]">Work</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {session.user.name ?? session.user.email}
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <NotificationBell />
        </nav>

        <form action={logoutAction} className="px-2 pb-4">
          <button
            type="submit"
            className="w-full text-left rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
          >
            Salir
          </button>
        </form>
      </aside>

      <main className="flex-1">{children}</main>
    </div>
  );
}
