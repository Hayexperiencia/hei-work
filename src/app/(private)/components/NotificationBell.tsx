"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const r = await fetch("/api/notifications?unread=true", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (active) setUnread(d.unread ?? 0);
      } catch {}
    }
    tick();
    const i = setInterval(tick, 30_000);
    return () => {
      active = false;
      clearInterval(i);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
    >
      <span aria-hidden="true">🔔</span>
      <span>Notificaciones</span>
      {unread > 0 && (
        <span className="absolute right-2 top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-[var(--accent-fg)]">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
