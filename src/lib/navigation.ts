export const SITE_NAVIGATION = {
  name: "StatsGH",
  primaryNav: [
    { label: "Top Stories", slug: "top-stories", type: "section" as const },
    { label: "Economy & Inflation", slug: "economy-inflation", type: "section" as const },
    { label: "Public Finance & Debt", slug: "public-finance-debt", type: "section" as const },
    { label: "Markets & Banking", slug: "markets-banking", type: "section" as const },
    { label: "Energy & Infrastructure", slug: "energy-infra", type: "section" as const },
    { label: "Business & Corporates", slug: "business", type: "section" as const },
    { label: "Households, Jobs & Wages", slug: "households-jobs", type: "section" as const },
    { label: "Trade & Investment", slug: "trade-investment", type: "section" as const },
    { label: "Policy & Governance", slug: "policy-governance", type: "section" as const },
    { label: "DataLab / Charts", slug: "datalab", type: "section" as const },
    { label: "Regions & Cities", slug: "regions-cities", type: "section" as const },
    { label: "Opinion & Columns", slug: "opinion-columns", type: "section" as const },
    { label: "Explainers & Guides", slug: "explainers-guides", type: "section" as const },
    { label: "GhanaCrimes", slug: "ghanacrimes", type: "external" as const, url: "https://ghanacrimes.com" }
  ],
  sideMenu: {
    grouped: [
      {
        label: "Macro & Public Finance",
        items: ["top-stories", "economy-inflation", "public-finance-debt", "policy-governance"]
      },
      {
        label: "Markets & Business",
        items: ["markets-banking", "business", "trade-investment", "energy-infra"]
      },
      {
        label: "People & Places",
        items: ["households-jobs", "regions-cities"]
      },
      {
        label: "Analysis",
        items: ["datalab", "opinion-columns", "explainers-guides"]
      },
      {
        label: "Verticals",
        items: ["ghanacrimes"]
      }
    ]
  }
};

export const SECTION_MAPPING = {
  "top-stories": "Top Stories",
  "economy-inflation": "Economy & Inflation",
  "public-finance-debt": "Public Finance & Debt",
  "markets-banking": "Markets & Banking",
  "energy-infra": "Energy & Infrastructure",
  "business": "Business & Corporates",
  "households-jobs": "Households, Jobs & Wages",
  "trade-investment": "Trade & Investment",
  "policy-governance": "Policy & Governance",
  "datalab": "DataLab / Charts",
  "regions-cities": "Regions & Cities",
  "opinion-columns": "Opinion & Columns",
  "explainers-guides": "Explainers & Guides"
} as const;

export type SectionSlug = keyof typeof SECTION_MAPPING;
