"use client";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/markets/MarketBits";

const LINKS = [
  { href: "/", label: "Homepage" },
  { href: "/markets/forex", label: "Cedi exchange rates" },
  { href: "/markets/rates", label: "T-bill and policy rates" },
  { href: "/trackers/cpi", label: "Inflation tracker" },
  { href: "/explorer", label: "Data Explorer" },
  { href: "/economy", label: "Economy news" },
  { href: "/contact", label: "Contact us" },
];

export default function NotFoundPage() {
  return (
    <PageShell title="Page not found" intro="We couldn't find that page. It may have moved, or the link may be wrong.">
      <form action="/search" method="get" className="flex gap-2 max-w-[520px] mb-8" role="search">
        <input name="q" type="search" placeholder="Search StatsGH" aria-label="Search StatsGH" className="flex-1 border border-[#D9D9D9] px-3 h-10 font-ui text-[14px]" />
        <button type="submit" className="bg-[#E3120B] text-white font-ui text-[14px] font-semibold px-5 h-10 hover:bg-[#B30E08]">Search</button>
      </form>
      <h2 className="kicker mb-2">Try one of these</h2>
      <ul className="grid sm:grid-cols-2 gap-2">
        {LINKS.map((l) => <li key={l.href}><Link to={l.href} className="font-ui text-[14px] underline text-[#E3120B]">{l.label}</Link></li>)}
      </ul>
    </PageShell>
  );
}
