import { Metadata } from "next";
import VerifyComment from "@/views/VerifyComment";

export const metadata: Metadata = {
  title: "Verify Comment - StatsGH",
  description: "Verify your comment on StatsGH.",
};

// Disable static generation since this page uses React Query
export const dynamic = "force-dynamic";

export default function VerifyCommentPage() {
  return <VerifyComment />;
}
