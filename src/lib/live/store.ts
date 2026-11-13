import type { LiveStore } from "./types";

/**
 * Pick the data source.
 * - LIVE_PAGES_ADAPTER=file (or mock) uses the local JSON store (local preview / tests).
 * - otherwise Supabase (production and default).
 * File store is imported only when requested so client/edge bundles never pull node:fs.
 */
export async function getLiveStore(): Promise<LiveStore> {
  const adapter = (process.env.LIVE_PAGES_ADAPTER || "").toLowerCase();
  if (adapter === "file" || adapter === "mock") {
    const { FileLiveStore, defaultStorePath } = await import("./file-store");
    return new FileLiveStore(defaultStorePath());
  }
  const { supabaseLiveStoreFromEnv } = await import("./supabase-store");
  return supabaseLiveStoreFromEnv();
}
