export const SECTION_TO_CATEGORIES: Record<string, string[]> = {
  'top-stories': ['top-stories', 'ghanacrimes', 'general', 'news'],
  'economy': ['macroeconomy', 'public-finance', 'labour-and-jobs', 'economy', 'fiscal-policy', 'monetary-policy'],
  'markets-data': ['markets', 'markets-data', 'stocks', 'forex', 'commodities'],
  'business': ['banking-and-finance', 'trade-and-industry', 'infrastructure-and-transport', 'business', 'corporate', 'sme'],
  'politics-policy': ['regulation-and-policy', 'politics-policy', 'politics', 'governance', 'parliament'],
  'energy-resources': ['energy-and-utilities', 'energy-resources', 'energy', 'oil-gas', 'mining', 'utilities'],
  'agriculture': ['agriculture-and-commodities', 'agriculture', 'farming', 'cocoa', 'food'],
  'technology': ['technology-and-digital-economy', 'technology', 'tech', 'digital', 'fintech', 'telecoms'],
  'companies': ['corporate-ghana', 'companies', 'corporate', 'banking', 'insurance'],
  'opinion-analysis': ['opinion-analysis', 'opinion', 'analysis', 'commentary', 'editorial'],
  'research': ['data-and-research', 'research', 'academic', 'report', 'survey'],
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
