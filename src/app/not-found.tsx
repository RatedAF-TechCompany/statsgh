import type { Metadata } from "next";
import NotFoundView from "@/views/NotFoundPage";

export const metadata: Metadata = {
  title: "Page not found | StatsGH",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundView />;
}
