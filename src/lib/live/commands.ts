import type { LiveStore, StartInput, AddInput, SummaryInput, EditInput, EndInput } from "./types";

export async function liveStart(store: LiveStore, input: StartInput) {
  return store.start(input);
}
export async function liveAdd(store: LiveStore, input: AddInput) {
  return store.add(input);
}
export async function liveSummary(store: LiveStore, input: SummaryInput) {
  return store.summary(input);
}
export async function liveEdit(store: LiveStore, input: EditInput) {
  return store.edit(input);
}
export async function liveEnd(store: LiveStore, input: EndInput) {
  return store.end(input);
}

/** Soft-fail on-demand revalidate so publishing does not need a redeploy. */
export async function pingLiveRevalidate(path?: string): Promise<string> {
  const secret = process.env.REVALIDATE_SECRET;
  const origin = process.env.SITE_ORIGIN || "https://www.statsgh.com";
  if (!secret) return "skipped (REVALIDATE_SECRET not set)";
  try {
    const res = await fetch(`${origin.replace(/\/$/, "")}/api/revalidate-live`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ path: path || null }),
    });
    return `HTTP ${res.status}`;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return `failed (${msg})`;
  }
}
