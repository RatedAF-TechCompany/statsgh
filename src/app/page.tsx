import { Metadata } from "next";
import Home from "@/views/Home";

// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
  title: "StatsGH - Ghana's Premier News Source",
  description:
    "We retell the story with numbers openly sourced in Ghanaian news. Get the latest news, data, and analysis on Ghana's economy, politics, and society.",
  keywords:
    "Ghana news, Ghana statistics, Ghana economy, Ghana data, Ghana politics, StatsGH",
  alternates: {
    canonical: "https://statsgh.com",
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
    title: "StatsGH - Ghana's Premier News Source",
    description:
      "We retell the story with numbers openly sourced in Ghanaian news.",
    url: "https://statsgh.com",
    siteName: "StatsGH",
    locale: "en_GH",
    images: [
      {
        url: "https://statsgh.com/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "StatsGH - Ghana's Premier News Source",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "StatsGH - Ghana's Premier News Source",
    description:
      "We retell the story with numbers openly sourced in Ghanaian news.",
    images: [
      {
        url: "https://statsgh.com/social/statsgh-og-1200x630.png",
        alt: "StatsGH - Ghana's Premier News Source",
      },
    ],
  },
};

// JSON-LD structured data for Organization and WebSite
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://statsgh.com/#website",
      url: "https://statsgh.com",
      name: "StatsGH",
      description: "Ghana's Premier News Source",
      publisher: {
        "@id": "https://statsgh.com/#organization",
      },
      inLanguage: "en",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://statsgh.com/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "NewsMediaOrganization",
      "@id": "https://statsgh.com/#organization",
      name: "StatsGH",
      url: "https://statsgh.com",
      logo: {
        "@type": "ImageObject",
        url: "https://statsgh.com/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
      },
      sameAs: [
        "https://twitter.com/StatsGH",
        "https://www.facebook.com/StatsGH",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        availableLanguage: "English",
      },
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Home />
    </>
  );
}
