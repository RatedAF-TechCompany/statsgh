"use client";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, ShareRow, KeyNumbersBox, Methodology } from "@/components/markets/MarketBits";
import { FollowButton } from "@/components/FollowButton";
import { fetchCompanies, DEAL_TYPES } from "@/lib/companies";
import { fetchGseHistory, GSE_LABEL, GSE_URL, ghs, pct, intl } from "@/lib/gse";
import { fmtDay } from "@/lib/bogRates";

type Art = { id: string; title: string; slug: string; category_slug: string; summary: string | null; published_at: string | null; deal_type: string | null };

const ArtList = ({ items }: { items: Art[] }) => (
  <ul className="divide-y divide-[#EFEFEF]">
    {items.map((a) => (
      <li key={a.id} className="py-2">
        <Link to={`/${a.category_slug}/${a.slug}`} className="font-headline text-[16px] font-bold hover:underline">{a.title}</Link>
        <p className="font-ui text-[11px] text-[#5B5B5B]">{a.published_at ? fmtDay(a.published_at.slice(0, 10)) : ""}{a.deal_type ? ` · ${DEAL_TYPES[a.deal_type] || a.deal_type}` : ""}</p>
      </li>
    ))}
  </ul>
);

const CompanyProfile = () => {
  const { slug } = useParams();
  const cos = useQuery({ queryKey: ["companies"], queryFn: fetchCompanies });
  const c = (cos.data || []).find((x) => x.slug === slug);
  const hist = useQuery({ queryKey: ["gse-hist", c?.symbol], queryFn: () => fetchGseHistory(c!.symbol), enabled: !!c });
  const arts = useQuery({ queryKey: ["co-arts", c?.symbol], enabled: !!c, queryFn: async () => ((await (supabase as any).rpc("company_articles", { p_symbol: c!.symbol, p_results_only: false, p_limit: 50 })).data || []) as Art[] });
  const results = useQuery({ queryKey: ["co-results", c?.symbol], enabled: !!c, queryFn: async () => ((await (supabase as any).rpc("company_articles", { p_symbol: c!.symbol, p_results_only: true, p_limit: 50 })).data || []) as Art[] });

  if (cos.isLoading) return <PageShell title="Company"><p className="text-sm text-[#5B5B5B]">Loading…</p></PageShell>;
  if (!c) return <PageShell title="Company not found"><p className="font-serif text-[17px] text-[#5B5B5B]">No listed company matches this address. <Link to="/companies" className="underline text-[#E3120B]">See all companies</Link>.</p></PageShell>;
  const l = (hist.data || []).slice(-1)[0];

  return (
    <PageShell wide kicker={<><Link to="/companies" className="hover:underline">Companies</Link> · {c.sector || "Unclassified"}</>} title={`${c.name} (${c.symbol})`}
      intro={`${c.name} is listed on the Ghana Stock Exchange under the ticker ${c.symbol}.`}>
      <div className="flex flex-wrap gap-3 items-center mb-3">
        <FollowButton type="company" targetKey={c.symbol} label={c.name} />
        <Link to={`/markets/gse/${c.symbol}`} className="font-ui text-[12px] underline text-[#E3120B]">Full price history and chart</Link>
      </div>
      {l ? (
        <KeyNumbersBox source={GSE_LABEL} sourceHref={l.source_url || GSE_URL} asOf={l.trade_date} items={[
          { label: "Closing price", value: ghs(l.close) },
          { label: "Daily change", value: pct(l.change_percent) },
          { label: "Volume", value: intl(l.volume) },
        ]} />
      ) : <p className="text-sm text-[#5B5B5B]">Price data unavailable.</p>}
      <ShareRow text={`${c.name} (${c.symbol}): price and StatsGH coverage`} path={`/companies/${c.slug}`} />

      <section className="py-4">
        <h2 className="kicker mb-2">Earnings and results timeline</h2>
        {results.isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : (results.data?.length ? <ArtList items={results.data} /> :
          <p className="text-sm text-[#5B5B5B]">StatsGH has not yet published a results, earnings or dividend story about {c.name}.</p>)}
      </section>
      <section className="py-4">
        <h2 className="kicker mb-2">All StatsGH stories mentioning {c.name}</h2>
        {arts.isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : (arts.data?.length ? <ArtList items={arts.data} /> :
          <p className="text-sm text-[#5B5B5B]">No StatsGH stories mention {c.name} yet.</p>)}
      </section>
      <Methodology>Stories are matched by the company's name appearing in a published StatsGH article. The results timeline lists only our own published articles tagged results, earnings or dividends, or with those words in the headline. We never estimate a company's financials.</Methodology>
    </PageShell>
  );
};
export default CompanyProfile;
