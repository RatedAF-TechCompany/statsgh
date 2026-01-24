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
    { label: "Top Stories", slug: "top-stories", type: "category" as const },
    { label: "Economy & Inflation", slug: "economy-inflation", type: "category" as const },
    { label: "Public Revenue & Spending", slug: "public-finance", type: "category" as const },
    { label: "Jobs, Salaries & Labour Market", slug: "labour-salaries", type: "category" as const },
    { label: "Agriculture & Food Systems", slug: "agriculture-food", type: "category" as const },
    { label: "Energy & Natural Resources", slug: "energy-resources", type: "category" as const },
    { label: "Trade, Markets & Investment", slug: "trade-investment", type: "category" as const },
    { label: "Health & Social Indicators", slug: "health-data", type: "category" as const },
    { label: "Education & Human Capital", slug: "education", type: "category" as const },
    { label: "Transport, Housing & Infrastructure", slug: "infrastructure-transport", type: "category" as const },
    { label: "Crime, Security & Governance", slug: "security-governance", type: "category" as const },
    { label: "Technology & Innovation", slug: "technology-innovation", type: "category" as const },
    { label: "Environment & Climate Data", slug: "environment-climate", type: "category" as const },
    { label: "Population & Demographics", slug: "population", type: "category" as const },
    { label: "Business Benchmarks", slug: "business", type: "category" as const },
    { label: "Opinion", slug: "opinion", type: "category" as const },
    { label: "Charts & Explainers", slug: "charts-explainers", type: "category" as const },
    { label: "GhanaCrimes", slug: "ghanacrimes", type: "external" as const, url: "https://ghanacrimes.com" }
  ]
};

export const CATEGORY_MAPPING = {
  "top-stories": "Top Stories",
  "economy-inflation": "Economy & Inflation",
  "public-finance": "Public Revenue & Spending",
  "labour-salaries": "Jobs, Salaries & Labour Market",
  "agriculture-food": "Agriculture & Food Systems",
  "energy-resources": "Energy & Natural Resources",
  "trade-investment": "Trade, Markets & Investment",
  "health-data": "Health & Social Indicators",
  "education": "Education & Human Capital",
  "infrastructure-transport": "Transport, Housing & Infrastructure",
  "security-governance": "Crime, Security & Governance",
  "technology-innovation": "Technology & Innovation",
  "environment-climate": "Environment & Climate Data",
  "population": "Population & Demographics",
  "business": "Business Benchmarks",
  "opinion": "Opinion",
  "charts-explainers": "Charts & Explainers",
  "ghanacrimes": "GhanaCrimes"
} as const;

export type CategorySlug = keyof typeof CATEGORY_MAPPING;
