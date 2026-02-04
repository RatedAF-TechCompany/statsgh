"use client";

import { Header } from "@/components/Header";
import TopicsOverview from "@/components/TopicsOverview";

export default function TopicsContent() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <TopicsOverview showHeader={true} />
      </main>
    </div>
  );
}
