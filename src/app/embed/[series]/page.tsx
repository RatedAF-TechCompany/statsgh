import type { Metadata } from "next";
import EmbedChart from "@/views/EmbedChart";

export const metadata: Metadata = { title: "StatsGH chart", robots: { index: false, follow: true } };

export default async function Page({ params }: { params: Promise<{ series: string }> }) {
  const { series } = await params;
  return <EmbedChart series={series} />;
}
