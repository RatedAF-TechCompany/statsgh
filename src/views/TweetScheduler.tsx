"use client";
// X Autopost admin: controls, review queue and 7-day log for statsgh-x-autopost.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { weightedLength } from "@/lib/xText";

const STATUSES = ["all", "held", "approved", "posted", "post_failed", "rejected_crime", "rejected_duplicate", "rejected_ineligible", "rejected_model", "discarded", "expired"];
const accra = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Accra", dateStyle: "medium", timeStyle: "short" }) : "—";

type Row = any;

function ReviewCard({ row, title, onDone }: { row: Row; title?: string; onDone: () => void }) {
  const [text, setText] = useState<string>(row.edited_text ?? row.post_text ?? "");
  const [busy, setBusy] = useState(false);
  const wl = weightedLength(text);
  const failed = Object.entries(row.code_checks_json || {})
    .filter(([k, v]: any) => !k.startsWith("_") && v && v.pass === false)
    .map(([k, v]: any) => `${k}${v.detail ? ` (${v.detail})` : ""}`);

  const act = async (action: "approve" | "discard") => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("statsgh-x-autopost", {
      body: action === "approve" ? { action, id: row.id, edited_text: text } : { action, id: row.id },
    });
    setBusy(false);
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json?.(); if (b?.failed) msg = `Checks failed: ${b.failed.join(", ")}`; } catch { /* ignore */ }
      toast.error(msg);
    } else toast.success(action === "approve" ? "Approved: it posts at the next open slot" : "Discarded");
    void data;
    onDone();
  };

  return (
    <div className="border border-border p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={row.status === "approved" ? "default" : "secondary"}>{row.status}</Badge>
        <a className="underline" href={row.url} target="_blank" rel="noreferrer">{title || row.url}</a>
        <span className="text-muted-foreground">{accra(row.created_at)}</span>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <p className={`text-xs ${wl > 280 ? "text-destructive" : "text-muted-foreground"}`}>{wl}/280 (X weighted, URL = 23)</p>
      {row.reject_reason && <p className="text-xs"><strong>Reason:</strong> {row.reject_reason}</p>}
      {failed.length > 0 && <p className="text-xs text-destructive"><strong>Failed checks:</strong> {failed.join("; ")}</p>}
      {row.alt_text && <p className="text-xs text-muted-foreground"><strong>Alt text:</strong> {row.alt_text}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => act("approve")}>Approve</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act("discard")}>Discard</Button>
      </div>
    </div>
  );
}

const TweetScheduler = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  const { data: isAdmin, isLoading: isLoadingAuth } = useQuery({
    queryKey: ["isAdmin", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
  });
  useEffect(() => {
    if (!isLoadingAuth && isAdmin === false) { toast.error("Access denied"); navigate("/"); }
  }, [isAdmin, isLoadingAuth, navigate]);

  const { data: flag } = useQuery({
    queryKey: ["xap-flag"], enabled: !!isAdmin,
    queryFn: async () => (await supabase.from("system_flags").select("enabled").eq("key", "AUTO_TWEET_ENABLED").maybeSingle()).data,
  });
  const { data: settings } = useQuery({
    queryKey: ["xap-settings"], enabled: !!isAdmin,
    queryFn: async () => (await supabase.from("x_autopost_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const since7 = useMemo(() => new Date(Date.now() - 7 * 86400_000).toISOString(), []);
  const { data: rows = [] } = useQuery({
    queryKey: ["xap-rows"], enabled: !!isAdmin,
    queryFn: async () => (await supabase.from("social_posts").select("*").gte("created_at", since7).order("created_at", { ascending: false }).limit(500)).data || [],
  });
  const ids = useMemo(() => Array.from(new Set(rows.map((r: Row) => r.article_id).filter(Boolean))), [rows]);
  const { data: titles = {} } = useQuery({
    queryKey: ["xap-titles", ids.join(",")], enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("articles").select("id, title").in("id", ids as string[]);
      return Object.fromEntries((data || []).map((a) => [a.id, a.title])) as Record<string, string>;
    },
  });

  const refresh = () => ["xap-flag", "xap-settings", "xap-rows"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const toggleFlag = async (on: boolean) => {
    const { error } = await supabase.from("system_flags").update({ enabled: on }).eq("key", "AUTO_TWEET_ENABLED");
    error ? toast.error(error.message) : toast.success(on ? "Autopost switched on" : "Autopost switched off");
    refresh();
  };
  const saveSettings = async () => {
    const f = form;
    const patch = {
      mode: f.mode, daily_cap: Math.min(6, Math.max(1, Number(f.daily_cap))), min_gap_minutes: Math.max(60, Number(f.min_gap_minutes)),
      quiet_start_utc: Number(f.quiet_start_utc), quiet_end_utc: Number(f.quiet_end_utc), model: f.model, temperature: Number(f.temperature),
    };
    const { error } = await supabase.from("x_autopost_settings").update(patch).eq("id", 1);
    error ? toast.error(error.message) : toast.success("Settings saved");
    refresh();
  };
  const runNow = async (dry: boolean) => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("statsgh-x-autopost", { body: { action: "run", dry_run: dry } });
    setRunning(false);
    if (error) toast.error(error.message);
    else toast.success(data?.code === "AUTO_TWEET_DISABLED" ? "Autopost is switched off: nothing ran" : (data?.skipped ? `Skipped: ${data.skipped}` : "Run finished"));
    refresh();
  };

  if (!session || isLoadingAuth || !isAdmin) return null;

  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const postedToday = rows.filter((r: Row) => r.status === "posted" && r.posted_at && new Date(r.posted_at) >= todayStart).length;
  const lastPosted = rows.filter((r: Row) => r.status === "posted" && r.posted_at).sort((a: Row, b: Row) => b.posted_at.localeCompare(a.posted_at))[0];
  let nextSlot = "—";
  if (settings) {
    const t = new Date(lastPosted?.posted_at ? new Date(lastPosted.posted_at).getTime() + settings.min_gap_minutes * 60_000 : Date.now());
    if (t.getTime() < Date.now()) t.setTime(Date.now());
    const h = t.getUTCHours();
    const qs = settings.quiet_start_utc, qe = settings.quiet_end_utc;
    const quiet = qs > qe ? (h >= qs || h < qe) : (h >= qs && h < qe);
    if (quiet) { if (h >= qe) t.setUTCDate(t.getUTCDate() + 1); t.setUTCHours(qe, 0, 0, 0); }
    nextSlot = postedToday >= Math.min(settings.daily_cap, 6) ? "tomorrow after quiet hours" : accra(t.toISOString());
  }
  const queue = rows.filter((r: Row) => r.status === "held" || r.status === "approved");
  const logRows = filter === "all" ? rows : rows.filter((r: Row) => r.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <h1 className="font-serif text-3xl font-bold">X Autopost</h1>

        <Card>
          <CardHeader><CardTitle>Controls</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={!!flag?.enabled} onCheckedChange={toggleFlag} id="autopost" />
              <Label htmlFor="autopost">Autopost {flag?.enabled ? "on" : "off"}</Label>
            </div>
            {form && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Mode</Label>
                  <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="review_only">review_only</SelectItem>
                      <SelectItem value="auto">auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Daily cap (1–6)</Label><Input type="number" min={1} max={6} value={form.daily_cap} onChange={(e) => setForm({ ...form, daily_cap: e.target.value })} /></div>
                <div><Label>Min gap (min, ≥60)</Label><Input type="number" min={60} value={form.min_gap_minutes} onChange={(e) => setForm({ ...form, min_gap_minutes: e.target.value })} /></div>
                <div><Label>Temperature</Label><Input type="number" step="0.1" min={0} max={1} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} /></div>
                <div><Label>Quiet start (Accra hour)</Label><Input type="number" min={0} max={23} value={form.quiet_start_utc} onChange={(e) => setForm({ ...form, quiet_start_utc: e.target.value })} /></div>
                <div><Label>Quiet end (Accra hour)</Label><Input type="number" min={0} max={23} value={form.quiet_end_utc} onChange={(e) => setForm({ ...form, quiet_end_utc: e.target.value })} /></div>
                <div className="col-span-2"><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={saveSettings}>Save settings</Button>
              <Button disabled={running} onClick={() => runNow(false)}>Run now</Button>
              <Button disabled={running} variant="outline" onClick={() => runNow(true)}>Dry run</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Posted today {postedToday}/{settings ? Math.min(settings.daily_cap, 6) : "—"} · last post {accra(lastPosted?.posted_at)} · next eligible slot {nextSlot}
            </p>
            {settings?.last_run_summary && (
              <details className="text-xs">
                <summary className="cursor-pointer">Last run {accra(settings.last_run_at)}</summary>
                <pre className="whitespace-pre-wrap break-all bg-muted p-2 mt-1">{JSON.stringify(settings.last_run_summary, null, 2)}</pre>
              </details>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Review queue ({queue.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {queue.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>}
            {queue.map((r: Row) => <ReviewCard key={r.id + (r.updated_at || "")} row={r} title={titles[r.article_id]} onDone={refresh} />)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Log (last 7 days)</CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Time (Accra)</TableHead><TableHead>Status</TableHead><TableHead>Article</TableHead><TableHead>Post</TableHead><TableHead>Reason</TableHead><TableHead>X</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {logRows.map((r: Row) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{accra(r.posted_at || r.created_at)}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[200px]"><a className="underline" href={r.url} target="_blank" rel="noreferrer">{titles[r.article_id] || r.url}</a></TableCell>
                    <TableCell className="text-xs max-w-[320px]">{r.edited_text || r.post_text || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[220px]">{r.reject_reason || ""}</TableCell>
                    <TableCell className="text-xs">{r.x_post_id ? <a className="underline" href={`https://x.com/i/web/status/${r.x_post_id}`} target="_blank" rel="noreferrer">view</a> : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TweetScheduler;
