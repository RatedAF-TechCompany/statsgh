import { Metadata } from "next";
import NewsContent from "./NewsContent";

export const metadata: Metadata = {
  title: "Latest News - StatsGH | Ghana News & Data Journalism",
  description:
    "Latest data journalism and analysis from Ghana. Stay informed with breaking news, in-depth analysis, and data-driven stories from StatsGH.",
  keywords:
    "Ghana news, Ghana latest news, Ghana breaking news, Ghana data journalism, StatsGH news",
  alternates: {
    canonical: "https://statsgh.com/news",
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    title: "Latest News - StatsGH",
    description:
      "Latest data journalism and analysis from Ghana. Stay informed with StatsGH.",
    url: "https://statsgh.com/news",
    siteName: "StatsGH",
    locale: "en_GH",
    images: [
      {
        url: "https://statsgh.com/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "StatsGH News",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "Latest News - StatsGH",
    description:
      "Latest data journalism and analysis from Ghana. Stay informed with StatsGH.",
    images: [
      {
        url: "https://statsgh.com/social/statsgh-og-1200x630.png",
        alt: "StatsGH News",
      },
    ],
  },
};

// JSON-LD for CollectionPage
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Latest News - StatsGH",
  description:
    "Latest data journalism and analysis from Ghana. Stay informed with StatsGH.",
  url: "https://statsgh.com/news",
  isPartOf: {
    "@type": "WebSite",
    "@id": "https://statsgh.com/#website",
  },
  publisher: {
    "@type": "NewsMediaOrganization",
    "@id": "https://statsgh.com/#organization",
    name: "StatsGH",
  },
  inLanguage: "en",
};

export default function NewsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NewsContent />
    </>
  );
}
