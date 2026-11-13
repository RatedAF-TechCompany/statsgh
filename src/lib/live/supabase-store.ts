/**
 * Production store. Writes go through SECURITY DEFINER RPCs (service role only).
 * Reads use the caller-supplied Supabase client (anon for public pages).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AddInput, EditInput, EndInput, LiveBannerItem, LiveEntry, LivePage,
  LivePageWithEntries, LiveStore, StartInput, SummaryInput,
} from "./types";
import { LiveValidationError } from "./validation";

type Sb = SupabaseClient;

function writeClient(): Sb {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to publish live pages");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function rpc<T>(sb: Sb, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(name, args);
  if (error) {
    const msg = error.message || String(error);
    if (/colon|headline|bullet|slug|not live|already|not found|must/i.test(msg)) {
      throw new LiveValidationError(msg);
    }
    throw new Error(msg);
  }
  return data as T;
}

function missingTable(err: { message?: string; code?: string } | null): boolean {
  const m = (err?.message || "") + (err?.code || "");
  return /42P01|live_pages|does not exist|schema cache/i.test(m);
}

export class SupabaseLiveStore implements LiveStore {
  private read: Sb;
  private write?: Sb;
  constructor(read: Sb, write?: Sb) {
    this.read = read;
    this.write = write;
  }

  private w(): Sb {
    return this.write || writeClient();
  }

  async start(input: StartInput): Promise<LivePageWithEntries> {
    return rpc<LivePageWithEntries>(this.w(), "live_start", {
      p_slug: input.slug,
      p_headline: input.headline,
      p_byline: input.byline,
      p_bullets: input.bullets,
      p_title: input.title,
      p_body: input.body,
      p_source_url: input.sourceUrl ?? null,
      p_source_label: input.sourceLabel ?? null,
      p_image_url: input.imageUrl ?? null,
      p_image_alt: input.imageAlt ?? null,
      p_image_caption: input.imageCaption ?? null,
      p_visibility: input.visibility ?? "public",
      p_date: input.date ?? null,
    });
  }

  async add(input: AddInput): Promise<LiveEntry> {
    return rpc<LiveEntry>(this.w(), "live_add", {
      p_slug: input.slug,
      p_title: input.title,
      p_body: input.body,
      p_source_url: input.sourceUrl ?? null,
      p_source_label: input.sourceLabel ?? null,
      p_image_url: input.imageUrl ?? null,
      p_image_alt: input.imageAlt ?? null,
      p_image_caption: input.imageCaption ?? null,
    });
  }

  async summary(input: SummaryInput): Promise<LivePage> {
    return rpc<LivePage>(this.w(), "live_summary", { p_slug: input.slug, p_bullets: input.bullets });
  }

  async edit(input: EditInput): Promise<LiveEntry> {
    return rpc<LiveEntry>(this.w(), "live_edit", {
      p_slug: input.slug,
      p_entry_id: input.entryId,
      p_title: input.title ?? null,
      p_body: input.body ?? null,
      p_source_url: input.sourceUrl === undefined ? undefined : input.sourceUrl,
      p_source_label: input.sourceLabel === undefined ? undefined : input.sourceLabel,
      p_image_url: input.imageUrl === undefined ? undefined : input.imageUrl,
      p_image_alt: input.imageAlt === undefined ? undefined : input.imageAlt,
      p_image_caption: input.imageCaption === undefined ? undefined : input.imageCaption,
    });
  }

  async end(input: EndInput): Promise<LivePageWithEntries> {
    return rpc<LivePageWithEntries>(this.w(), "live_end", {
      p_slug: input.slug,
      p_title: input.title,
      p_body: input.body,
    });
  }

  async getByPath(path: string, opts?: { includeHidden?: boolean; includeDraft?: boolean }): Promise<LivePageWithEntries | null> {
    const { data: page, error } = await this.read.from("live_pages").select("*").eq("path", path).maybeSingle();
    if (error) {
      if (missingTable(error)) return null;
      throw new Error(error.message);
    }
    if (!page) return null;
    if (page.status === "draft" && !opts?.includeDraft) return null;
    if (page.visibility === "hidden" && !opts?.includeHidden) return null;
    const { data: entries, error: e2 } = await this.read
      .from("live_entries")
      .select("*")
      .eq("page_id", page.id)
      .order("posted_at", { ascending: false });
    if (e2 && !missingTable(e2)) throw new Error(e2.message);
    return { ...(page as LivePage), entries: (entries || []) as LiveEntry[] };
  }

  async listPublic(): Promise<LivePage[]> {
    const { data, error } = await this.read
      .from("live_pages")
      .select("*")
      .eq("visibility", "public")
      .in("status", ["live", "ended"])
      .order("content_updated_at", { ascending: false });
    if (error) {
      if (missingTable(error)) return [];
      throw new Error(error.message);
    }
    return (data || []) as LivePage[];
  }

  async listLiveBanner(): Promise<LiveBannerItem[]> {
    const { data, error } = await this.read
      .from("live_pages")
      .select("path, headline, content_updated_at, started_at")
      .eq("visibility", "public")
      .eq("status", "live")
      .order("content_updated_at", { ascending: false });
    if (error) {
      if (missingTable(error)) return [];
      throw new Error(error.message);
    }
    return (data || []) as LiveBannerItem[];
  }
}

export function supabaseLiveStoreFromEnv(read?: Sb): SupabaseLiveStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const reader = read || (url && anon
    ? createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    : null);
  if (!reader) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  return new SupabaseLiveStore(reader);
}
