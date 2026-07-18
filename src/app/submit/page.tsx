import type { Metadata } from "next";
import SubmitClient from "./SubmitClient";

const title = "Submit Expert Commentary | StatsGH";
const description =
  "Economists, think tanks and researchers: contribute commentary and analysis to StatsGH.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://statsgh.com/submit" },
  openGraph: { title, description, url: "https://statsgh.com/submit", siteName: "StatsGH" },
};

export default function SubmitPage() {
  return <SubmitClient />;
}
