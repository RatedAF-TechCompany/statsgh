"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Methodology, PageShell, ShareRow } from "@/components/markets/MarketBits";

type Ev = {
  id: string; title: string; description: string | null; event_type: string; source_name: string | null; source_url: string | null;
  scheduled_date: string; status: string | null; actual_value: string | null; impact_level: string | null; date_precision: string; origin: string;
};

const TYPE: Record<string, string> = { data_release: "Data release", policy_meeting: "Policy meeting", budget: "Budget", other: "Event" };
const dayFmt = (d: string, week: boolean) => {
  const s = new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return week ? `Week of ${s}` : s;
};

function ics(evs: Ev[]) {
  const dt = (d: string) => d.slice(0, 10).replace(/-/g, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const body = evs.map((e) => {
    const end = new Date(new Date(e.scheduled_date).getTime() + (e.date_precision === "week" ? 5 : 1) * 864e5).toISOString();
    return ["BEGIN:VEVENT", `UID:${e.id}@statsgh.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${dt(e.scheduled_date)}`, `DTEND;VALUE=DATE:${dt(end)}`, `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(`${e.description ?? ""} Source: ${e.source_name ?? ""} ${e.source_url ?? ""}`.trim())}`, e.source_url ? `URL:${e.source_url}` : "", "END:VEVENT"].filter(Boolean).join("\r\n");
  }).join("\r\n");
  const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//StatsGH//Ghana release calendar//EN\r\n${body}\r\nEND:VCALENDAR\r\n`], { type: "text/calendar" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = evs.length === 1 ? "statsgh-event.ics" : "statsgh-calendar.ics"; a.click();
}

const AdminForm = ({ onSaved }: { onSaved: () => void }) => {
  const [f, setF] = useState({ title: "", scheduled_date: "", event_type: "data_release", source_name: "", source_url: "", description: "" });
  const [err, setErr] = useState("");
  const save = async () => {
    if (!f.title || !f.scheduled_date || !/^https?:\/\//.test(f.source_url)) return setErr("Title, date and a source URL are required.");
    const { error } = await supabase.from("economic_calendar").insert({ ...f, scheduled_date: `${f.scheduled_date}T09:00:00Z`, origin: "admin", status: "upcoming" });
    if (error) return setErr(error.message);
    setF({ title: "", scheduled_date: "", event_type: "data_release", source_name: "", source_url: "", description: "" }); setErr(""); onSaved();
  };
  const inp = "border border-[#D9D9D9] px-2 py-1 text-sm";
  return (
    <section className="border border-[#D9D9D9] p-3 my-4 font-ui text-sm">
      <h2 className="kicker mb-2">Add entry (editors only)</h2>
      <div className="grid md:grid-cols-3 gap-2">
        <input className={inp} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className={inp} type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} />
        <select className={inp} value={f.event_type} onChange={(e) => setF({ ...f, event_type: e.target.value })}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className={inp} placeholder="Source name" value={f.source_name} onChange={(e) => setF({ ...f, source_name: e.target.value })} />
        <input className={inp} placeholder="Source URL (required)" value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} />
        <input className={inp} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      {err && <p className="text-[#E3120B] mt-1">{err}</p>}
      <button className="mt-2 underline text-[#E3120B]" onClick={save}>Save entry</button>
    </section>
  );
};

const EconomicCalendar = () => {
  const qc = useQueryClient();
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [isEditor, setIsEditor] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id; if (!uid) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", uid).in("role", ["admin", "editor"]);
      setIsEditor(!!r?.length);
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", view],
    queryFn: async () => {
      // Week-precision entries stay "upcoming" through their week.
      const cut = new Date(Date.now() - (view === "upcoming" ? 6 : 0) * 864e5).toISOString();
      let q = supabase.from("economic_calendar").select("*").not("source_url", "is", null);
      q = view === "upcoming" ? q.gte("scheduled_date", cut).order("scheduled_date", { ascending: true }).limit(80)
        : q.lt("scheduled_date", new Date().toISOString()).order("scheduled_date", { ascending: false }).limit(80);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Ev[];
    },
  });
  const evs = (data || []).filter((e) => view === "past" || e.date_precision === "week" || new Date(e.scheduled_date) >= new Date(Date.now() - 864e5));
  const del = async (id: string) => { await supabase.from("economic_calendar").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["calendar"] }); };

  return (
    <PageShell wide kicker={<Link to="/dashboards" className="hover:underline">Dashboards</Link>} title="Ghana economic and data release calendar"
      intro="When Ghana's key numbers come out: Statistical Service releases (CPI, GDP and more), Bank of Ghana policy decisions and weekly T-bill auctions. Every entry links to its source.">
      <div className="flex flex-wrap items-center gap-4 font-ui text-[13px] mb-2">
        {(["upcoming", "past"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={view === v ? "font-bold border-b-2 border-[#E3120B]" : "underline text-[#E3120B]"}>{v === "upcoming" ? "Upcoming" : "Past"}</button>
        ))}
        {evs.length > 0 && <button className="underline text-[#E3120B]" onClick={() => ics(evs)}>Add all to calendar (.ics)</button>}
      </div>
      <ShareRow text="Ghana economic and data release calendar" path="/calendar" />
      {isEditor && <AdminForm onSaved={() => qc.invalidateQueries({ queryKey: ["calendar"] })} />}

      {isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : evs.length === 0 ? (
        <p className="font-serif text-[17px] text-[#5B5B5B] py-4">No {view} entries stored.</p>
      ) : (
        <ol className="divide-y divide-[#EFEFEF] border-t border-[#D9D9D9]">
          {evs.map((e) => (
            <li key={e.id} className="py-3 grid md:grid-cols-[170px_1fr_auto] gap-2">
              <div className="font-ui text-[13px] font-semibold text-[#121212]">{dayFmt(e.scheduled_date, e.date_precision === "week")}</div>
              <div>
                <p className="font-ui text-[11px] uppercase tracking-wide text-[#5B5B5B]">{TYPE[e.event_type] ?? e.event_type}{e.impact_level === "high" ? " · high impact" : ""}{e.status === "released" ? " · released" : ""}</p>
                <h3 className="font-serif text-[17px] font-bold text-[#121212]">{e.title}{e.actual_value ? ` — ${e.actual_value}` : ""}</h3>
                {e.description && <p className="text-sm text-[#5B5B5B]">{e.description}</p>}
                <p className="font-ui text-[11px] text-[#5B5B5B]">Source: <a className="underline" href={e.source_url!} target="_blank" rel="noopener noreferrer">{e.source_name || e.source_url}</a></p>
              </div>
              <div className="font-ui text-[12px] flex md:flex-col gap-2">
                <button className="underline text-[#E3120B]" onClick={() => ics([e])}>.ics</button>
                {isEditor && <button className="underline text-[#5B5B5B]" onClick={() => del(e.id)}>Delete</button>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <Methodology>
        <p>Statistical Service dates come from the official GSS release calendar, which gives the week of the month rather than an exact day, so those entries say "Week of". Bank of Ghana policy decisions come from the BoG policy-rate history. T-bill auctions are listed for the next eight Fridays; public holidays can move them.</p>
        <p>Future MPC meeting dates, GSE holidays and budget dates are added by editors only when officially announced, always with a source link.</p>
      </Methodology>
    </PageShell>
  );
};

export default EconomicCalendar;
