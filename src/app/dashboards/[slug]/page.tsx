export const dynamic = "force-dynamic"; // live data page: render per request
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/pageMeta";
import { getTopicDashboard } from "@/lib/topicDashboards";
import WdiDashboard from "@/views/WdiDashboard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = getTopicDashboard((await params).slug);
  return t ? pageMeta(`/dashboards/${t.slug}`, t.title, t.intro) : {};
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const t = getTopicDashboard((await params).slug);
  if (!t) notFound();
  return <WdiDashboard t={t} />;
}
