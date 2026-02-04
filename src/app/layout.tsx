import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "StatsGH - Ghana's Premier News Source",
  description: "We retell the story with numbers openly sourced in Ghanaian news.",
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
    title: "StatsGH - Ghana's Premier News Source",
    description: "We retell the story with numbers openly sourced in Ghanaian news.",
    images: ["/social/statsgh-og-1200x630.png"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "StatsGH - Ghana's Premier News Source",
    description: "We retell the story with numbers openly sourced in Ghanaian news.",
    images: ["/social/statsgh-og-1200x630.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
