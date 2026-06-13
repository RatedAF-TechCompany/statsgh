import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

// News content changes constantly and most pages fetch live data, so render
// on-demand (SSR) rather than statically prerendering at build time. Article
// pages still emit full server-rendered HTML + metadata for crawlers.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StatsGH – Ghana's Premier Data Journalism Platform",
  description:
    "Ghana's premier data journalism platform. We retell the story with numbers, openly sourced.",
  metadataBase: new URL("https://statsgh.com"),
  applicationName: "StatsGH",
  appleWebApp: {
    title: "StatsGH",
    capable: true,
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.ico",
    apple: "/favicon.png",
  },
  openGraph: {
    type: "website",
    url: "https://statsgh.com/",
    title: "StatsGH – Ghana's Premier Data Journalism Platform",
    description:
      "Ghana's premier data journalism platform. We retell the story with numbers, openly sourced.",
    siteName: "StatsGH",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "StatsGH – Ghana's Premier Data Journalism Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "StatsGH – Ghana's Premier Data Journalism Platform",
    description:
      "Ghana's premier data journalism platform. We retell the story with numbers, openly sourced.",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        alt: "StatsGH – Ghana's Premier Data Journalism Platform",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
