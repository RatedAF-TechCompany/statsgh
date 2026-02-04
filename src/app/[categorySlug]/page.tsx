import { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_MAPPING, CategorySlug } from "@/lib/navigation";
import CategoryContent from "./CategoryContent";

interface CategoryPageProps {
  params: Promise<{
    categorySlug: string;
  }>;
}

// Pre-generate category pages at build time
export function generateStaticParams() {
  return Object.keys(CATEGORY_MAPPING).map((slug) => ({
    categorySlug: slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params;

  // Check if this is a valid category
  if (!(categorySlug in CATEGORY_MAPPING)) {
    return {
      title: "Page Not Found - StatsGH",
    };
  }

  const categoryLabel = CATEGORY_MAPPING[categorySlug as CategorySlug];
  const description = `Latest ${categoryLabel} news, data, and analysis from Ghana. Stay informed with StatsGH's comprehensive ${categoryLabel.toLowerCase()} coverage.`;
  const canonicalUrl = `https://statsgh.com/${categorySlug}`;

  return {
    title: `${categoryLabel} News - StatsGH | Ghana ${categoryLabel}`,
    description,
    keywords: `Ghana ${categoryLabel}, ${categoryLabel} news Ghana, StatsGH ${categoryLabel}, Ghana ${categoryLabel.toLowerCase()} news`,
    alternates: {
      canonical: canonicalUrl,
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
      title: `${categoryLabel} - StatsGH`,
      description,
      url: canonicalUrl,
      siteName: "StatsGH",
      locale: "en_GH",
      images: [
        {
          url: "https://statsgh.com/social/statsgh-og-1200x630.png",
          width: 1200,
          height: 630,
          alt: `StatsGH ${categoryLabel}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@StatsGH",
      title: `${categoryLabel} - StatsGH`,
      description,
      images: [
        {
          url: "https://statsgh.com/social/statsgh-og-1200x630.png",
          alt: `StatsGH ${categoryLabel}`,
        },
      ],
    },
  };
}

// Generate JSON-LD for CollectionPage
function generateJsonLd(categorySlug: string, categoryLabel: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${categoryLabel} News - StatsGH`,
    description: `Latest ${categoryLabel} news, data, and analysis from Ghana.`,
    url: `https://statsgh.com/${categorySlug}`,
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
    about: {
      "@type": "Thing",
      name: categoryLabel,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params;

  // Validate this is a known category
  if (!(categorySlug in CATEGORY_MAPPING)) {
    notFound();
  }

  const categoryLabel = CATEGORY_MAPPING[categorySlug as CategorySlug];
  const jsonLd = generateJsonLd(categorySlug, categoryLabel);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CategoryContent categorySlug={categorySlug} categoryLabel={categoryLabel} />
    </>
  );
}
