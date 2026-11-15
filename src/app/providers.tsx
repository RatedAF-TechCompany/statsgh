"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Toast containers are only needed after a user action, so they load once the page is idle
// instead of shipping in every page's initial JS. (Tooltips bring their own TooltipProvider.)
const Toaster = dynamic(() => import("@/components/ui/toaster").then((m) => m.Toaster), { ssr: false });
const Sonner = dynamic(() => import("@/components/ui/sonner").then((m) => m.Toaster), { ssr: false });

function IdleToasters() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setReady(true), { timeout: 3000 });
    else setTimeout(() => setReady(true), 1500);
  }, []);
  if (!ready) return null;
  return (
    <>
      <Toaster />
      <Sonner />
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <IdleToasters />
      {children}
    </QueryClientProvider>
  );
}
