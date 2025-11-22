export const SITE_NAVIGATION = {
  name: "StatsGH",
  categories: [
    { label: "Top Stories", slug: "top-stories", type: "category" as const },
    { label: "Economy & Inflation", slug: "economy-inflation", type: "category" as const },
    { label: "Public Finance & Debt", slug: "public-finance-debt", type: "category" as const },
    { label: "Markets & Banking", slug: "markets-banking", type: "category" as const },
    { label: "Business & Corporates", slug: "business", type: "category" as const },
    { label: "Trade & Investment", slug: "trade-investment", type: "category" as const },
    { label: "Energy & Infrastructure", slug: "energy-infra", type: "category" as const },
    { label: "Households, Jobs & Wages", slug: "households-jobs", type: "category" as const },
    { label: "Regions & Cities", slug: "regions-cities", type: "category" as const },
    { label: "DataLab / Charts", slug: "datalab", type: "category" as const },
    { label: "Opinion & Columns", slug: "opinion-columns", type: "category" as const },
    { label: "Explainers & Guides", slug: "explainers-guides", type: "category" as const },
    { label: "GhanaCrimes", slug: "ghanacrimes", type: "external" as const, url: "https://ghanacrimes.com" }
  ]
};

export const CATEGORY_MAPPING = {
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

export type CategorySlug = keyof typeof CATEGORY_MAPPING;
