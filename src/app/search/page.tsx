import { Metadata } from "next";
import { Suspense } from "react";
import Search from "@/views/Search";

export const metadata: Metadata = {
  title: "Search - StatsGH",
  description: "Search for articles, data, and topics on StatsGH.",
};

// Disable static generation since this page uses useSearchParams
export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Search />
    </Suspense>
  );
}
