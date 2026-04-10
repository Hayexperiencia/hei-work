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
      className="relative flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white"
    >
      <span aria-hidden="true">🔔</span>
      <span>Notificaciones</span>
      {unread > 0 && (
        <span className="absolute right-2 top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#ffcd07] px-1 text-[10px] font-bold text-[#0a0a1a]">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
