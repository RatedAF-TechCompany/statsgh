"use client";

export function LiveBadge({ ended }: { ended: boolean }) {
  if (ended) {
    return (
      <span className="inline-flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B5B5B]">
        <span className="inline-block h-2 w-2 rounded-full bg-[#5B5B5B]" aria-hidden />
        Ended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-[0.08em] text-[#E3120B]">
      <span
        className="inline-block h-2 w-2 rounded-full bg-[#E3120B] animate-live-pulse"
        aria-hidden
      />
      Live
    </span>
  );
}
