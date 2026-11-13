import type { Metadata } from "next";
import { LiveIndexClient } from "./LiveIndexClient";
import { getLiveStore } from "@/lib/live/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Live coverage | StatsGH",
  description: "Live coverage from StatsGH — Ghana's data journalism platform.",
  alternates: { canonical: "https://www.statsgh.com/live" },
};

export default async function LiveIndexPage() {
  const store = await getLiveStore();
  const pages = await store.listPublic();
  return <LiveIndexClient pages={pages} />;
}
