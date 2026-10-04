import { Link } from "react-router-dom";

const TRACKERS = [
  { href: "/trackers/fuel-and-cedi", title: "Fuel & Cedi Weekly", blurb: "Cedi exchange rates, Brent crude and Ghana pump prices.", re: /\b(fuel|petrol|diesel|pump price|crude|brent|oil price|cedi|exchange rate|forex|depreciat|lpg)\b/i },
  { href: "/trackers/cpi", title: "Inflation Explainer", blurb: "Monthly headline, food and non-food inflation and what it means for your money.", re: /\b(inflation|cpi|consumer price|cost of living)\b/i },
  { href: "/trackers/crime-justice", title: "Crime & Justice Statistics", blurb: "Arrests, convictions, cases and sums involved in Ghana crime stories.", re: /\b(crime|court|police|arrest|convict|fraud|corruption|robbery|prosecut|osp|eoco|judge|sentenc)\b/i },
];

export function matchTrackers(input: { title?: string | null; tags?: string[] | null; category_slug?: string | null; section?: string | null }) {
  const text = [input.title, input.category_slug, input.section, ...(input.tags || [])].filter(Boolean).join(" ").replace(/-/g, " ");
  return TRACKERS.filter((t) => t.re.test(text));
}

export const RelatedTracker = (props: Parameters<typeof matchTrackers>[0]) => {
  const matches = matchTrackers(props);
  if (matches.length === 0) return null;
  return (
    <aside aria-label="Related tracker" className="my-8 border-t border-[#D9D9D9] pt-4">
      <h2 className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-[#5B5B5B] mb-3">
        Related tracker{matches.length > 1 ? "s" : ""}
      </h2>
      <ul className="space-y-2">
        {matches.map((t) => (
          <li key={t.href}>
            <Link to={t.href} className="font-ui text-sm font-semibold text-[#E3120B] hover:underline">{t.title} →</Link>
            <span className="font-ui text-sm text-[#5B5B5B]"> {t.blurb}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
};
