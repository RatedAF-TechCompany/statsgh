"use client";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/markets/MarketBits";
import { fetchBogSnapshot, fmtDay } from "@/lib/bogRates";

const CARDS = [
  { href: "/markets/forex", title: "Cedi exchange rates", body: "Official Bank of Ghana USD, GBP and EUR rates, with daily change and history." },
  { href: "/markets/rates", title: "Interest rates", body: "91, 182 and 364-day T-bill rates, the policy rate since 2002, and the interbank rate." },
  { href: "/trackers/fuel-and-cedi", title: "Fuel & Cedi Weekly", body: "The cedi, Brent crude and Ghana pump prices side by side." },
  { href: "/trackers/inflation", title: "Inflation", body: "Headline, food and non-food CPI inflation readings and what they mean for your money." },
  { href: "/dashboards/commodities", title: "Commodities", body: "Brent, WTI, cocoa and gold prices, each with its source and date." },
  { href: "/tools/cost-of-living", title: "Cost of Living Calculator", body: "Estimate how fuel, cedi and price changes affect your monthly budget." },
];

const FinanceHub = () => {
  const { data } = useQuery({ queryKey: ["bog-snapshot"], queryFn: fetchBogSnapshot });
  const facts = [
    data?.usd && `US$1 = GH₵${data.usd.value.toFixed(4)} (BoG, ${fmtDay(data.usd.date)})`,
    data?.t91 && `91-day T-bill ${data.t91.value.toFixed(2)}% (auction ${fmtDay(data.t91.date)})`,
    data?.policy && `Policy rate ${data.policy.value.toFixed(1)}% (since ${fmtDay(data.policy.date)})`,
  ].filter(Boolean) as string[];
  return (
    <PageShell wide kicker={<Link to="/dashboards" className="hover:underline">Dashboards</Link>} title="Ghana finance dashboard" intro="Every money number we track for Ghana in one place. Each page shows its official source and the date of its latest figure.">
      {facts.length > 0 && <p className="font-ui text-[13px] text-[#5B5B5B] mb-4">{facts.join(" · ")}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} to={c.href} className="block border border-[#D9D9D9] border-t-4 border-t-[#E3120B] p-4 hover:bg-[#F6F6F6]">
            <h2 className="font-serif text-[20px] font-bold text-[#121212] mb-1">{c.title}</h2>
            <p className="font-ui text-[13px] text-[#5B5B5B]">{c.body}</p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
};
export default FinanceHub;
