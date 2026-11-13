"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LiveBadge } from "./LiveBadge";
import type { LiveBannerItem } from "@/lib/live/types";

export function LiveBanner({ initial }: { initial?: LiveBannerItem[] }) {
  const [items, setItems] = useState<LiveBannerItem[]>(initial ?? []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.pages)) setItems(data.pages);
      } catch {
        // Keep the last good list; the banner is an enhancement.
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="bg-[#FFF5F4] border-b border-[#E3120B]/20" data-live-banner="true">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-2.5 flex flex-col gap-1.5">
        {items.map((item) => (
          <Link
            key={item.path}
            to={`/live/${item.path}`}
            className="flex items-baseline gap-3 min-w-0 hover:opacity-80"
          >
            <LiveBadge ended={false} />
            <span className="font-headline text-[16px] md:text-[18px] font-bold text-[#121212] truncate">
              {item.headline}
            </span>
            <span className="ml-auto hidden sm:inline font-ui text-[12px] text-[#E3120B] shrink-0">
              Follow live →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
