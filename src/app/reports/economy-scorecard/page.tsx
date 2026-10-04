export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createReadOnlyServerClient } from "@/lib/supabase/server";

export default async function LatestScorecard() {
  const { data } = await createReadOnlyServerClient().from("reports").select("edition").eq("kind", "economy-scorecard").order("edition", { ascending: false }).limit(1);
  redirect(data?.[0] ? `/reports/economy-scorecard/${data[0].edition}` : "/reports");
}
