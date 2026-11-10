import type { Metadata } from "next";

// Personal / utility page: keep it out of search results.
export const metadata: Metadata = { title: "Your dashboard | StatsGH", robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
