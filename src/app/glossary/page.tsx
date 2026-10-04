import type { Metadata } from "next";
import Glossary from "@/views/Glossary";

const title = "Glossary of Ghana economic terms | StatsGH";
const description = "Plain-English definitions of CPI, T-bill yields, the policy rate, cedi depreciation, GDP growth, debt-to-GDP and more.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://statsgh.com/glossary" },
  openGraph: { type: "website", title, description, url: "https://statsgh.com/glossary", siteName: "StatsGH" },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function Page() {
  return <Glossary />;
}
