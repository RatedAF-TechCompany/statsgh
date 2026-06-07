import { getSectionForCategory } from "@/lib/sectionMapping";

export const SITE_SECTIONS = [
  { label: "Top Stories", slug: "top-stories", href: "/" },
  { label: "Economy", slug: "economy", href: "/economy" },
  { label: "Markets & Data", slug: "markets-data", href: "/markets-data" },
  { label: "Business", slug: "business", href: "/business" },
  { label: "Politics & Policy", slug: "politics-policy", href: "/politics-policy" },
  { label: "Energy & Resources", slug: "energy-resources", href: "/energy-resources" },
  { label: "Agriculture", slug: "agriculture", href: "/agriculture" },
  { label: "Technology", slug: "technology", href: "/technology" },
  { label: "Companies", slug: "companies", href: "/companies" },
  { label: "Analysis", slug: "analysis", href: "/analysis" },
  { label: "Opinion & Analysis", slug: "opinion-analysis", href: "/opinion-analysis" },
  { label: "Research", slug: "research", href: "/research" },
  { label: "Financial Literacy", slug: "financial-literacy", href: "/financial-literacy" },
  { label: "World", slug: "world", href: "/world" },
] as const;

export const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  SITE_SECTIONS.map(s => [s.slug, s.label])
);

// Get section label for a category_slug
export const getSectionLabel = (categorySlug: string): string => {
  const sectionSlug = getSectionForCategory(categorySlug);
  return SECTION_LABEL[sectionSlug] || "Top Stories";
};

export const getSectionSlug = (categorySlug: string): string => {
  return getSectionForCategory(categorySlug);
};

// Keep old exports for backward compatibility
export const CATEGORY_TO_SECTION: Record<string, string> = {};

export const SITE_NAVIGATION = {
  name: "StatsGH",
  defaultCountry: "Ghana",
  primary: [
    { label: "Topics", href: "/topics" },
    { label: "Data", href: "/data" },
    { label: "News", href: "/news" },
    { label: "Dashboards", href: "/dashboards" },
    { label: "Sources", href: "/sources" },
  ],
  categories: [
    { label: "Macroeconomy", slug: "macroeconomy", type: "category" as const },
    { label: "Markets", slug: "markets", type: "category" as const },
    { label: "Public Finance", slug: "public-finance", type: "category" as const },
    { label: "Banking and Finance", slug: "banking-and-finance", type: "category" as const },
    { label: "Energy and Utilities", slug: "energy-and-utilities", type: "category" as const },
    { label: "Trade and Industry", slug: "trade-and-industry", type: "category" as const },
    { label: "Corporate Ghana", slug: "corporate-ghana", type: "category" as const },
    { label: "Agriculture and Commodities", slug: "agriculture-and-commodities", type: "category" as const },
    { label: "Infrastructure and Transport", slug: "infrastructure-and-transport", type: "category" as const },
    { label: "Data and Research", slug: "data-and-research", type: "category" as const },
    { label: "Regulation and Policy", slug: "regulation-and-policy", type: "category" as const },
    { label: "Technology and Digital Economy", slug: "technology-and-digital-economy", type: "category" as const },
    { label: "Labour and Jobs", slug: "labour-and-jobs", type: "category" as const },
    { label: "Regional Economy", slug: "regional-economy", type: "category" as const },
    { label: "GhanaCrimes", slug: "ghanacrimes", type: "external" as const, url: "https://ghanacrimes.com" }
  ]
};

export const CATEGORY_MAPPING = {
  "macroeconomy": "Macroeconomy",
  "markets": "Markets",
  "public-finance": "Public Finance",
  "banking-and-finance": "Banking and Finance",
  "energy-and-utilities": "Energy and Utilities",
  "trade-and-industry": "Trade and Industry",
  "corporate-ghana": "Corporate Ghana",
  "agriculture-and-commodities": "Agriculture and Commodities",
  "infrastructure-and-transport": "Infrastructure and Transport",
  "data-and-research": "Data and Research",
  "regulation-and-policy": "Regulation and Policy",
  "technology-and-digital-economy": "Technology and Digital Economy",
  "labour-and-jobs": "Labour and Jobs",
  "regional-economy": "Regional Economy",
  "ghanacrimes": "GhanaCrimes",
  // Section-level labels
  "top-stories": "Top Stories",
  "economy": "Economy",
  "markets-data": "Markets & Data",
  "business": "Business",
  "politics-policy": "Politics & Policy",
  "energy-resources": "Energy & Resources",
  "agriculture": "Agriculture",
  "technology": "Technology",
  "companies": "Companies",
  "opinion-analysis": "Opinion & Analysis",
  "research": "Research",
  "world": "World",
} as const;

export type CategorySlug = keyof typeof CATEGORY_MAPPING;
