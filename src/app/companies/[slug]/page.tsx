export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import CompanyProfile from "@/views/CompanyProfile";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const { data } = await (createReadOnlyServerClient() as any).from("companies").select("name, symbol").eq("slug", slug).maybeSingle();
  const n = data ? `${data.name} (${data.symbol})` : slug.toUpperCase();
  return pageMeta(`/companies/${slug}`, `${n}: share price, results and news`, `${n} on the Ghana Stock Exchange: latest end-of-day price, earnings and results timeline, and StatsGH coverage.`);
}
export default function Page() { return <CompanyProfile />; }
