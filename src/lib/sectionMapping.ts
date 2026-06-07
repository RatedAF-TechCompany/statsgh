export const SECTION_TO_CATEGORIES: Record<string, string[]> = {
  'top-stories': ['top-stories', 'ghanacrimes', 'general', 'news', 'security-governance'],
  'economy': ['macroeconomy', 'public-finance', 'labour-and-jobs', 'economy', 'fiscal-policy', 'monetary-policy', 'economy-inflation', 'labour-salaries', 'population'],
  'markets-data': ['markets', 'markets-data', 'stocks', 'forex', 'commodities', 'financial-markets', 'capital-markets', 'gse', 'currency'],
  'business': ['banking-and-finance', 'trade-and-industry', 'infrastructure-and-transport', 'business', 'corporate', 'sme', 'trade-investment', 'infrastructure-transport'],
  'politics-policy': ['regulation-and-policy', 'politics-policy', 'politics', 'governance', 'parliament'],
  'energy-resources': ['energy-and-utilities', 'energy-resources', 'energy', 'oil-gas', 'mining', 'utilities', 'mining-and-resources', 'environment-climate'],
  'agriculture': ['agriculture-and-commodities', 'agriculture', 'farming', 'cocoa', 'food', 'agriculture-food'],
  'technology': ['technology-and-digital-economy', 'technology', 'tech', 'digital', 'fintech', 'telecoms', 'technology-innovation'],
  'companies': ['corporate-ghana', 'companies', 'corporate', 'banking', 'insurance'],
  'analysis': ['analysis', 'long-form', 'deep-dive'],
  'opinion-analysis': ['opinion-analysis', 'opinion', 'commentary', 'editorial'],
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
