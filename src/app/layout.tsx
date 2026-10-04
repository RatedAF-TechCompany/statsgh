import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { InstallPrompt } from "@/components/InstallPrompt";

// No site-wide force-dynamic: home, section and article pages use ISR (revalidate 120s,
// plus on-demand revalidation via /api/revalidate); other pages opt into dynamic themselves.

export const metadata: Metadata = {
  title: "StatsGH – Ghana's Premier Data Journalism Platform",
  description:
    "Ghana's premier data journalism platform. We retell the story with numbers, openly sourced.",
  metadataBase: new URL("https://www.statsgh.com"),
  // Self-referencing canonical on every page (resolved against metadataBase); pages may override.
  alternates: {
    canonical: "./",
    types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] },
  },
  applicationName: "StatsGH",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    title: "StatsGH",
    capable: true,
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    type: "website",
    url: "https://www.statsgh.com/",
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
        <Providers>{children}<InstallPrompt /></Providers>
      </body>
    </html>
  );
}
