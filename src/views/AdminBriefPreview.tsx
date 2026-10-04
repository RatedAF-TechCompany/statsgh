"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { fetchBogFx, latestFx, fmtDay, BOG_URLS } from "@/lib/bogRates";
import { fetchLatestGse, GSE_URL, ghs, pct } from "@/lib/gse";

const AdminBriefPreview = () => {
  const session = useQuery({ queryKey: ["session"], queryFn: async () => (await supabase.auth.getSession()).data.session });
  const allowed = useQuery({
    queryKey: ["isAdminOrEditor", session.data?.user?.id], enabled: !!session.data?.user?.id,
    queryFn: async () => !!(await supabase.from("user_roles").select("role").eq("user_id", session.data!.user.id).in("role", ["admin", "editor"])).data?.length,
  });
  const fx = useQuery({ queryKey: ["bog-fx-brief"], queryFn: () => fetchBogFx(10), enabled: !!allowed.data });
  const gse = useQuery({ queryKey: ["gse-latest"], queryFn: fetchLatestGse, enabled: !!allowed.data });
  const stories = useQuery({
    queryKey: ["brief-stories"], enabled: !!allowed.data,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data } = await (supabase as any).from("articles").select("id, title, slug, category_slug, summary, key_data, published_at")
        .eq("is_published", true).eq("is_sponsored", false).gte("published_at", since).order("published_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  if (session.isLoading || allowed.isLoading) return null;
  if (!allowed.data) return <div><Header /><p className="p-8 font-ui">Admins and editors only. <Link to="/auth" className="underline">Sign in</Link>.</p></div>;

  const rows = fx.data || [];
  const pairs = ["USD", "GBP", "EUR"].map((c) => ({ c, l: latestFx(rows, `${c}/GHS`) || latestFx(rows, c) }));
  const movers = (gse.data || []).filter((p) => (p.change_percent ?? 0) !== 0).sort((a, b) => Math.abs(b.change_percent!) - Math.abs(a.change_percent!)).slice(0, 5);
  const top = stories.data || [];
  const kd = top.flatMap((a: any) => (Array.isArray(a.key_data) ? a.key_data.map((k: any) => ({ ...k, a })) : [])).find((k: any) => k?.label && k?.value);

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <Header />
      <div className="max-w-[640px] mx-auto my-6">
        <p className="font-ui text-[12px] bg-[#FFF8E6] border border-[#B8860B] p-2 mb-3">Preview only. Sending is disabled: no email provider is connected, and nothing on this page sends mail.</p>
        <div className="bg-white p-8 font-serif">
          <p className="font-ui text-[11px] uppercase tracking-widest text-[#5B5B5B]">StatsGH Morning Brief · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="font-headline text-[26px] font-bold my-3">Ghana's numbers this morning</h1>

          <h2 className="font-ui text-[12px] uppercase tracking-wider font-bold mt-5 mb-1">Cedi rates (Bank of Ghana)</h2>
          {pairs.some((x) => x.l) ? <ul className="text-[15px]">{pairs.filter((x) => x.l).map(({ c, l }) => <li key={c}>{c}/GHS {l!.value.toFixed(4)} <span className="text-[#5B5B5B] text-[12px]">({fmtDay(l!.date)})</span></li>)}</ul>
            : <p className="text-[14px] text-[#5B5B5B]">Rates unavailable.</p>}
          <p className="font-ui text-[11px] text-[#5B5B5B]">Source: <a href={BOG_URLS.fx} className="underline">Bank of Ghana</a></p>

          <h2 className="font-ui text-[12px] uppercase tracking-wider font-bold mt-5 mb-1">GSE movers {gse.data?.[0] ? `(${fmtDay(gse.data[0].trade_date)})` : ""}</h2>
          {movers.length ? <ul className="text-[15px]">{movers.map((p) => <li key={p.symbol}>{p.symbol} {ghs(p.close)} <strong>{pct(p.change_percent)}</strong></li>)}</ul> : <p className="text-[14px] text-[#5B5B5B]">No price changes in the latest session.</p>}
          <p className="font-ui text-[11px] text-[#5B5B5B]">Source: <a href={GSE_URL} className="underline">Ghana Stock Exchange</a>, end-of-day</p>

          {kd && (<><h2 className="font-ui text-[12px] uppercase tracking-wider font-bold mt-5 mb-1">Key number</h2>
            <p className="text-[22px] font-bold">{kd.value}{kd.unit ? ` ${kd.unit}` : ""}</p><p className="text-[14px]">{kd.label} — <a className="underline" href={`/${kd.a.category_slug}/${kd.a.slug}`}>{kd.a.title}</a></p></>)}

          <h2 className="font-ui text-[12px] uppercase tracking-wider font-bold mt-5 mb-1">Top stories (last 24 hours)</h2>
          {top.length ? top.map((a: any) => <div key={a.id} className="py-2 border-b border-[#EFEFEF]"><a href={`/${a.category_slug}/${a.slug}`} className="font-bold text-[16px]">{a.title}</a>{a.summary && <p className="text-[14px] text-[#5B5B5B]">{a.summary}</p>}</div>)
            : <p className="text-[14px] text-[#5B5B5B]">No stories published in the last 24 hours.</p>}
          <p className="font-ui text-[11px] text-[#8A8A8A] mt-6">You receive this because you subscribed at statsgh.com. Manage preferences or unsubscribe: [personal link].</p>
        </div>
      </div>
    </div>
  );
};
export default AdminBriefPreview;
