/**
 * On-site key-figure tiles (Zeb, 4 Nov 2026).
 * Display-time swap: when an article's hero image is the auto-generated /og/article/ social card,
 * render a pure HTML/CSS tile instead. The /og card itself stays the og:image for social.
 * No source credits on tiles. Crime stories: dark text-only tile, never a figure or chart.
 */

// ── Edit section colours here (placeholders, pending sign-off) ──
export const SECTION_TILE_COLOURS: Record<string, string> = {
  economy: "#E3120B", // red
  energy: "#C9670A", // amber
  markets: "#0B6E4F", // green
  data: "#1F4E8C", // blue
  crime: "#2B2B2B", // charcoal
  default: "#E3120B",
};

const SECTION_GROUPS: [RegExp, keyof typeof SECTION_TILE_COLOURS][] = [
  [/crime|justice|ghanacrimes/, "crime"],
  [/energy|utilit|oil|power/, "energy"],
  [/market|banking|forex|rates|gse|stock|capital/, "markets"],
  [/data|research|tracker/, "data"],
  [/econom|fiscal|finance|budget|trade|labour|agri|infra|corporate|business|policy/, "economy"],
];

export interface TileArticle {
  title: string;
  slug?: string;
  category_slug?: string | null;
  section?: string | null;
  hero_image_url?: string | null;
  key_data?: unknown;
}

export const isOgCardUrl = (url?: string | null) => typeof url === "string" && url.includes("/og/article/");

export function tileGroup(a: TileArticle): keyof typeof SECTION_TILE_COLOURS {
  // category first, then section (crime matched on either)
  const keys = [a.category_slug, a.section].map((k) => (k ?? "").toLowerCase());
  if (keys.some((k) => /crime|justice|ghanacrimes/.test(k))) return "crime";
  for (const k of keys) for (const [re, g] of SECTION_GROUPS) if (k && re.test(k)) return g;
  return "default";
}

const SECTION_NAMES: Record<string, string> = { economy: "Economy", energy: "Energy", markets: "Markets", data: "Data", crime: "Crime & Justice", default: "StatsGH" };

// Same filtering rules as the /og card (src/lib/ogArticle.tsx).
const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/i;
const NON_STAT_LABEL = /\b(date|day|days|time|hour|year|month|edition|anniversary|session|deadline|phone)\b/i;
const toNum = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "")));

export function keyFigure(a: TileArticle): { value: string; label: string } | null {
  if (tileGroup(a) === "crime" || !Array.isArray(a.key_data)) return null;
  const k = (a.key_data as { label?: string; value?: unknown; unit?: string }[]).find(
    (k) => k?.label && Number.isFinite(toNum(k.value)) && !(k.unit && (MONTHS.test(k.unit.trim()) || /^(years?|months?|days?|hours?|weeks?)$/i.test(k.unit.trim()))) && !NON_STAT_LABEL.test(k.label),
  );
  if (!k) return null;
  const n = toNum(k.value);
  const unit = (k.unit ?? "").trim();
  const num = Math.abs(n) >= 1e9 ? `${+(n / 1e9).toFixed(1)}bn` : Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)}m` : n.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  let value = num;
  const scale = unit.match(/^(?:(US\$|USD|GH[S₵C]|\$)\s*)?(million|billion|bn|m)\b\s*(.*)$/i);
  if (scale) {
    const cur = scale[1] ? (/^GH/i.test(scale[1]) ? "GH₵" : "US$") : "";
    return { value: `${cur}${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${/^b/i.test(scale[2]) ? "bn" : "m"}${scale[3] && scale[3].length <= 8 ? " " + scale[3] : ""}`, label: (k.label as string).slice(0, 60) };
  }
  let label = k.label as string;
  if (unit === "%" || /^per\s?cent$/i.test(unit)) value = `${num}%`;
  else if (/^(GH[S₵C]|GHS|US\$|\$|USD)$/i.test(unit)) value = `${unit.toUpperCase() === "USD" ? "US$" : unit.toUpperCase() === "GHS" ? "GH₵" : unit}${num}`;
  else if (unit && unit.length <= 4) value = `${num} ${unit}`;
  else if (unit && !label.toLowerCase().includes(unit.toLowerCase())) label = `${unit} — ${label}`;
  return { value, label: label.slice(0, 60) };
}

const LOGO = "/images/statsgh-logo-white.png"; // white-on-transparent (Zeb, 4 Nov 2026)

/** Large tile for lead / grid slots. Fills its parent; parent sets aspect ratio. */
export function KeyFigureTile({ article, className = "", size = "md", figureTop = false, plain = false }: { article: TileArticle; className?: string; size?: "sm" | "md" | "lg"; figureTop?: boolean; plain?: boolean }) {
  const pos = figureTop ? "top-[20%]" : "bottom-[9%]";
  const g = tileGroup(article);
  const fig = plain ? null : keyFigure(article);
  const crime = g === "crime";
  const big = size === "lg" ? "text-[56px] md:text-[84px]" : size === "sm" ? "text-[18px]" : "text-[44px] md:text-[56px]";
  const sm = size === "sm";
  return (
    <div
      aria-hidden="true"
      className={`site-tile relative h-full w-full overflow-hidden text-white ${className}`}
      style={{ background: SECTION_TILE_COLOURS[g] }}
    >
      <div className="site-tile-texture absolute inset-0" />
      {!sm && <span className="absolute left-[6%] top-[8%] font-ui text-[10px] md:text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">{SECTION_NAMES[g]}</span>}
      <img src={LOGO} alt="" width={480} height={111} loading="lazy" className={`no-treat absolute right-[6%] top-[6%] w-auto ${sm ? "h-2.5" : "h-4 md:h-5"}`} />
      {fig ? (
        <div className={`absolute inset-x-[6%] ${pos}`}>
          <div className={`font-ui font-extrabold leading-none tracking-[-0.03em] ${big}`}>{fig.value}</div>
          {size !== "sm" && <div className="mt-2 font-ui text-[12px] md:text-[14px] text-white/85 line-clamp-2">{fig.label}</div>}
        </div>
      ) : (
        <div className={`absolute inset-x-[6%] ${pos}`}>
          <span className="block h-1 w-10 bg-white/80" />
          {crime && size !== "sm" && <div className="mt-3 font-ui text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">StatsGH Crime Desk</div>}
        </div>
      )}
    </div>
  );
}

/** Compact-row left slot: big figure as text (no thumbnail). Returns null when no figure (incl. crime). */
export function CompactFigure({ article, className = "" }: { article: TileArticle; className?: string }) {
  const fig = keyFigure(article);
  if (!fig) return null;
  const colour = SECTION_TILE_COLOURS[tileGroup(article)];
  return (
    <div className={`w-24 flex-shrink-0 border-l-4 pl-2 ${className}`} style={{ borderColor: colour }} aria-hidden="true">
      <div className={`font-ui ${fig.value.length > 7 ? "text-[15px]" : "text-[18px]"} font-extrabold leading-tight tracking-[-0.02em] whitespace-nowrap`} style={{ color: colour }}>{fig.value}</div>
      <div className="mt-0.5 font-ui text-[10px] leading-snug text-[#666] line-clamp-2">{fig.label}</div>
    </div>
  );
}

/* ── House photo treatments (Zeb, 4 Nov 2026): no raw photo ever shows on site pages ── */
export type PhotoPalette = "bw" | "red" | "orange" | "cream";
const PALETTES: PhotoPalette[] = ["red", "bw", "orange", "cream"];
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
export function photoPalette(a: TileArticle): PhotoPalette {
  if (tileGroup(a) === "crime") return "bw"; // crime: B&W only, no accents
  return PALETTES[hash(a.slug || a.title || "") % PALETTES.length];
}

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
// True duotones (shadows -> ink/colour, highlights -> cream), tuned against palette-refs (4 Nov 2026).
const STOPS: Record<PhotoPalette, string[]> = {
  bw: ["#0E0E0E", "#3A3A3A", "#7C7C7C", "#C9C9C9", "#FFFFFF"],
  red: ["#2A0604", "#9E0D07", "#D8392A", "#EFB5A6", "#F3EDE4"],
  orange: ["#7A2E12", "#E06A3C", "#F2A27E", "#F8D9C6", "#F8F3EC"],
  cream: ["#141414", "#4D4945", "#8E8983", "#D6CFC5", "#F3EDE4"],
};
const LIFT = { slope: 1.2, intercept: 0.08 }; // contrast/brightness lift before the duotone map

/** Render once per page (in the root layout). SVG filters referenced by .photo-treat-*. */
export function PhotoFilterDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      {(Object.keys(STOPS) as PhotoPalette[]).map((p) => {
        const rgb = STOPS[p].map(hexToRgb);
        const t = (c: number) => rgb.map((x) => x[c].toFixed(3)).join(" ");
        return (
          <filter id={`sgh-${p}`} key={p} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" />
            <feComponentTransfer><feFuncR type="linear" slope={LIFT.slope} intercept={LIFT.intercept} /><feFuncG type="linear" slope={LIFT.slope} intercept={LIFT.intercept} /><feFuncB type="linear" slope={LIFT.slope} intercept={LIFT.intercept} /></feComponentTransfer>
            <feComponentTransfer><feFuncR type="table" tableValues={t(0)} /><feFuncG type="table" tableValues={t(1)} /><feFuncB type="table" tableValues={t(2)} /></feComponentTransfer>
          </filter>
        );
      })}
    </svg>
  );
}

/** A real photo, always treated. Fills its parent. */
export function TreatedImg({ article, src, alt = "", className = "", eager = false, onError, itemProp }: {
  article: TileArticle; src: string; alt?: string; className?: string; eager?: boolean; onError?: () => void; itemProp?: string;
}) {
  const p = photoPalette(article);
  return (
    <div className={`photo-treat photo-treat-${p} relative h-full w-full overflow-hidden`}>
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={onError} itemProp={itemProp} className={`h-full w-full object-cover ${className}`} style={{ filter: `url(#sgh-${p})` }} />
      {p === "cream" && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={`0,${48 + (hash(article.slug || "") % 4)} 18,47 36,51 55,44 74,46 100,${36 + (hash(article.title) % 6)}`} fill="none" stroke="#E3120B" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2.5 }} />
          <polyline points="0,54 22,52 44,54 66,49 86,51 100,46" fill="none" stroke="#1F4E8C" style={{ strokeWidth: 1.5 }} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}

/**
 * One hero slot: key-figure tile when the URL is the /og card, otherwise the real photo, house-treated.
 * `wrapClass` sizes the slot (e.g. "aspect-[16/9]").
 */
export function HeroSlot({ article, wrapClass = "", imgClass = "", size = "md", eager = false, alt = "" }: {
  article: TileArticle; wrapClass?: string; imgClass?: string; size?: "sm" | "md" | "lg"; eager?: boolean; alt?: string;
}) {
  if (!article.hero_image_url) return null;
  if (isOgCardUrl(article.hero_image_url)) return <div className={wrapClass}><KeyFigureTile article={article} size={size} /></div>;
  return <div className={wrapClass}><TreatedImg article={article} src={article.hero_image_url} alt={alt} className={imgClass} eager={eager} /></div>;
}

/** Drop-in for any article <img>: fills its (sized) parent. /og card -> tile, real photo -> treated. */
export function ArticleImage({ article, size = "sm", alt = "", className = "", eager = false, plain = false }: {
  article: TileArticle; size?: "sm" | "md" | "lg"; alt?: string; className?: string; eager?: boolean; plain?: boolean;
}) {
  if (!article.hero_image_url) return null;
  if (isOgCardUrl(article.hero_image_url)) return <KeyFigureTile article={article} size={size} plain={plain} />;
  return <TreatedImg article={article} src={article.hero_image_url} alt={alt} className={className} eager={eager} />;
}
