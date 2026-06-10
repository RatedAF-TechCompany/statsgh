// Inline SVG branded section fallback cards (data URIs — no asset files needed).
// Returns a 3:2 placeholder card with the section label, in the StatsGH palette.

const SECTION_LABELS: Record<string, string> = {
  "top-stories": "Top Stories",
  economy: "Economy",
  markets: "Markets",
  business: "Business",
  politics: "Politics & Policy",
  energy: "Energy & Mining",
  agriculture: "Agriculture",
  technology: "Technology",
  research: "Research",
  data: "Data",
  world: "World",
  analysis: "Analysis",
  "financial-literacy": "Financial Literacy",
  opinion: "Opinion",
};

// Map common category slugs → section
const CATEGORY_TO_SECTION: Record<string, string> = {
  macroeconomy: "economy",
  "public-finance": "economy",
  labour: "economy",
  stocks: "markets",
  forex: "markets",
  commodities: "markets",
  banking: "business",
  corporate: "business",
  trade: "business",
  industry: "business",
  policy: "politics",
  regulation: "politics",
  governance: "politics",
  mining: "energy",
  oil: "energy",
  utilities: "energy",
  cocoa: "agriculture",
  farming: "agriculture",
  food: "agriculture",
  digital: "technology",
  fintech: "technology",
  telecoms: "technology",
  academic: "research",
  africa: "world",
  international: "world",
};

function svgDataUri(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
    <defs>
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#EDE9E0" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="600" height="400" fill="#F5F2EC"/>
    <rect width="600" height="400" fill="url(#hatch)"/>
    <rect x="40" y="40" width="80" height="3" fill="#E3120B"/>
    <text x="40" y="80" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" letter-spacing="2" fill="#E3120B" text-transform="uppercase">${label.toUpperCase()}</text>
    <text x="40" y="370" font-family="Playfair Display, Georgia, serif" font-size="28" font-weight="700" fill="#121212">StatsGH</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getSectionFallback(section?: string | null, categorySlug?: string | null): string {
  const key =
    (section && SECTION_LABELS[section] ? section : null) ||
    (categorySlug && CATEGORY_TO_SECTION[categorySlug]) ||
    (categorySlug && SECTION_LABELS[categorySlug] ? categorySlug : null) ||
    "top-stories";
  return svgDataUri(SECTION_LABELS[key] || "StatsGH");
}
