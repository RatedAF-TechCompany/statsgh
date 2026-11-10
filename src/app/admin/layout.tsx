import type { Metadata } from "next";

// Admin (server-guarded by middleware): keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
