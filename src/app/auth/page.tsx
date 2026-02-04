import { Metadata } from "next";
import { Suspense } from "react";
import Auth from "@/views/Auth";

export const metadata: Metadata = {
  title: "Sign In - StatsGH",
  description: "Sign in to your StatsGH account to save articles and access personalized features.",
};

// Disable static generation since this page uses useSearchParams
export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Auth />
    </Suspense>
  );
}
