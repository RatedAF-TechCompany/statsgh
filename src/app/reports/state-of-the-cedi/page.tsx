export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createReadOnlyServerClient } from "@/lib/supabase/server";

export default async function LatestCedi() {
  // Prefer the latest complete month; fall back to the month in progress.
  const { data } = await createReadOnlyServerClient().from("reports").select("edition, data").eq("kind", "state-of-the-cedi").order("edition", { ascending: false }).limit(2);
  const pick = (data || []).find((r: any) => r.data?.complete) || data?.[0];
  redirect(pick ? `/reports/state-of-the-cedi/${pick.edition}` : "/reports");
}
