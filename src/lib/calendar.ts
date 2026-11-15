// Economic calendar fetcher shared by the calendar page (client) and server rendering.
import { supabase } from "@/integrations/supabase/client";

export type CalEvent = {
  id: string; title: string; description: string | null; event_type: string; source_name: string | null; source_url: string | null;
  scheduled_date: string; status: string | null; actual_value: string | null; impact_level: string | null; date_precision: string; origin: string;
};

export async function fetchCalendar(view: "upcoming" | "past"): Promise<CalEvent[]> {
  // Week-precision entries stay "upcoming" through their week.
  const cut = new Date(Date.now() - (view === "upcoming" ? 6 : 0) * 864e5).toISOString();
  let q = supabase.from("economic_calendar").select("*").not("source_url", "is", null);
  q = view === "upcoming" ? q.gte("scheduled_date", cut).order("scheduled_date", { ascending: true }).limit(80)
    : q.lt("scheduled_date", new Date().toISOString()).order("scheduled_date", { ascending: false }).limit(80);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as CalEvent[];
}
