export const SECTION_TO_CATEGORIES: Record<string, string[]> = {
  'top-stories': ['top-stories', 'general', 'news'],
  // MUST stay in sync with CRIME_JUSTICE_SLUGS in supabase/functions/_shared/crime-gate.ts (X autopost crime gate).
  'crime-justice': ['crime-justice', 'crime', 'crime-and-justice', 'justice', 'security-governance', 'ghanacrimes', 'courts', 'security'],
  'economy': ['macroeconomy', 'public-finance', 'labour-and-jobs', 'economy', 'fiscal-policy', 'monetary-policy', 'economy-inflation', 'labour-salaries', 'population'],
  'markets-data': ['markets', 'markets-data', 'stocks', 'forex', 'commodities', 'financial-markets', 'capital-markets', 'gse', 'currency'],
  'business': ['banking-and-finance', 'trade-and-industry', 'infrastructure-and-transport', 'business', 'corporate', 'sme', 'trade-investment', 'infrastructure-transport'],
  'politics-policy': ['regulation-and-policy', 'politics-policy', 'politics', 'governance', 'parliament'],
  'energy-resources': ['energy-and-utilities', 'energy-resources', 'energy', 'oil-gas', 'mining', 'utilities', 'mining-and-resources', 'environment-climate'],
  'agriculture': ['agriculture-and-commodities', 'agriculture', 'farming', 'cocoa', 'food', 'agriculture-food'],
  'technology': ['technology-and-digital-economy', 'technology', 'tech', 'digital', 'fintech', 'telecoms', 'technology-innovation'],
  'companies': ['corporate-ghana', 'companies', 'corporate', 'banking', 'insurance'],
  'opinion-analysis': ['opinion-analysis', 'opinion', 'commentary', 'editorial', 'analysis', 'long-form', 'deep-dive'],
  'research': ['data-and-research', 'research', 'academic', 'report', 'survey', 'health-data', 'education'],
  'financial-literacy': ['financial-literacy', 'explainer', 'personal-finance', 'literacy'],
  'world': ['regional-economy', 'world', 'africa', 'international', 'global'],
};

export function getCategoriesForSection(sectionSlug: string): string[] {
  return SECTION_TO_CATEGORIES[sectionSlug] || [sectionSlug];
}

export function getSectionForCategory(categorySlug: string): string {
  for (const [section, categories] of Object.entries(SECTION_TO_CATEGORIES)) {
    if (categories.includes(categorySlug)) return section;
  }
  return 'top-stories';
}

/** Tags that place a (Ghana-relevant) story in Crime & Justice. */
export const CRIME_JUSTICE_TAGS = ['crime', 'justice', 'security-governance'];

/** PostgREST `or` filter listing every Crime & Justice story. */
export function crimeJusticeOrFilter(): string {
  const cats = SECTION_TO_CATEGORIES['crime-justice'].map((s) => `"${s}"`).join(',');
  return `category_slug.in.(${cats}),section.eq.crime-justice,tags.ov.{${CRIME_JUSTICE_TAGS.join(',')}}`;
}

export const SECTION_INTROS: Record<string, string> = {
  'crime-justice':
    "Crime, courts, policing and corruption in Ghana, reported through the numbers: cases, sentences, sums lost and recovered, and the institutions handling them — from the Ghana Police Service and EOCO to the Office of the Special Prosecutor and the courts.",
};
