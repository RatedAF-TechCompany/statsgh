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
  "ghanacrimes": "GhanaCrimes"
} as const;

export type CategorySlug = keyof typeof CATEGORY_MAPPING;
