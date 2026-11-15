export const dynamic = "force-dynamic"; // live data page: render per request
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/pageMeta";
import { getTopicDashboard } from "@/lib/topicDashboards";
import { fetchMacro } from "@/lib/macro";
import { Prefetched } from "@/components/ssr/Prefetched";
import WdiDashboard from "@/views/WdiDashboard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = getTopicDashboard((await params).slug);
  return t ? pageMeta(`/dashboards/${t.slug}`, t.title, t.intro) : {};
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const t = getTopicDashboard((await params).slug);
  if (!t) notFound();
  const keys = t.series.map((s) => s.key);
  // Same query as the view, run on the server so the key numbers are in the first HTML.
  return (
    <Prefetched queries={[{ queryKey: ["macro", "topic", t.slug], queryFn: () => fetchMacro(keys) }]}>
      <WdiDashboard t={t} />
    </Prefetched>
  );
}
