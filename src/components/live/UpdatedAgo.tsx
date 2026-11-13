"use client";

import { useEffect, useState } from "react";
import { formatUpdatedAgo } from "@/lib/live/format";

export function UpdatedAgo({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => formatUpdatedAgo(iso));
  useEffect(() => {
    const tick = () => setLabel(formatUpdatedAgo(iso));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [iso]);
  return (
    <time dateTime={iso} className={className}>
      {label}
    </time>
  );
}
