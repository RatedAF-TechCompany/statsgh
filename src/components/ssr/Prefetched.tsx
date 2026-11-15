// Server component: runs the same React Query fetchers a client view uses, on the server, and
// hands the results to the browser cache. The view then renders real numbers in the first HTML
// (no "Loading…" before JavaScript) and refreshes in the background as before.
import { dehydrate, HydrationBoundary, QueryClient, type QueryKey } from "@tanstack/react-query";

export type PrefetchSpec = { queryKey: QueryKey; queryFn: () => Promise<unknown> };

export async function Prefetched({ queries, children }: { queries: PrefetchSpec[]; children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
  // A failed prefetch is simply left out; the client view then loads it as before.
  await Promise.all(queries.map((q) => qc.prefetchQuery(q).catch(() => undefined)));
  return <HydrationBoundary state={dehydrate(qc)}>{children}</HydrationBoundary>;
}

/** JSON-LD script tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
