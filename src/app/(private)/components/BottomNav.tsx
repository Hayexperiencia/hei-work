"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const PRIMARY: NavItem[] = [
  { href: "/board", label: "Board", icon: "📋" },
  { href: "/business", label: "Negocio", icon: "💼" },
  { href: "/notifications", label: "Inbox", icon: "🔔" },
  { href: "/team", label: "Equipo", icon: "👥" },
];

const SECONDARY: NavItem[] = [
  { href: "/objectives", label: "OKRs", icon: "🎯" },
  { href: "/projects", label: "Proyectos", icon: "🗂️" },
  { href: "/tools", label: "Tools", icon: "🔧" },
  { href: "/automations", label: "Automatizaciones", icon: "⚡" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
];

interface Props {
  logoutAction: () => Promise<void>;
  userName: string;
}

export default function BottomNav({ logoutAction, userName }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchUnread() {
      try {
        const r = await fetch("/api/notifications?unread=true", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (active) setUnread(d.unread ?? 0);
      } catch {}
    }
    fetchUnread();
    const i = setInterval(fetchUnread, 30_000);
    return () => {
      active = false;
      clearInterval(i);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Bottom nav bar — visible solo en mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-[var(--border-base)] bg-[var(--bg-elevated)] pb-safe"
        aria-label="Navegacion principal"
      >
        {PRIMARY.map((item) => {
          const active = isActive(item.href);
          const isInbox = item.href === "/notifications";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                active
                  ? "text-[var(--accent)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {isInbox && unread > 0 && (
                <span className="absolute top-1 right-[calc(50%-18px)] inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-[var(--accent-fg)]">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
        >
          <span className="text-lg leading-none" aria-hidden>
            ☰
          </span>
          <span>Mas</span>
        </button>
      </nav>

      {/* Drawer con secundarios + theme toggle + logout */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMenuOpen(false);
          }}
        >
          <div className="w-full rounded-t-2xl border-t border-[var(--border-base)] bg-[var(--bg-elevated)] pb-safe">
            <div className="mx-auto my-2 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            <div className="px-4 pb-2 pt-1">
              <div className="text-xs text-[var(--fg-muted)]">Sesion</div>
              <div className="text-sm font-medium text-[var(--fg-primary)]">
                {userName}
              </div>
            </div>
            <nav className="py-1">
              {SECONDARY.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
                >
                  <span className="text-lg" aria-hidden>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="border-t border-[var(--border-base)]">
              <MobileThemeToggle />
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
                >
                  <span className="text-lg" aria-hidden>
                    ↪
                  </span>
                  <span>Salir</span>
                </button>
              </form>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-full border-t border-[var(--border-base)] py-3 text-xs text-[var(--fg-muted)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MobileThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined"
      ? localStorage.getItem("hei-theme")
      : null) as "dark" | "light" | null;
    setTheme(stored ?? "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const html = document.documentElement;
    if (next === "light") {
      html.classList.add("light");
      html.classList.remove("dark");
    } else {
      html.classList.add("dark");
      html.classList.remove("light");
    }
    localStorage.setItem("hei-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
    >
      <span className="text-lg" aria-hidden>
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
      <span>Tema {theme === "dark" ? "claro" : "oscuro"}</span>
    </button>
  );
}
