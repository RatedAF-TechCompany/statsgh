/**
 * File-backed store for local preview and self-tests. Not used in production.
 * Path comes from LIVE_PAGES_STORE (defaults to .live-pages.local.json in cwd).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  AddInput, EditInput, EndInput, LiveBannerItem, LiveEntry, LivePage,
  LivePageWithEntries, LiveStore, StartInput, SummaryInput,
} from "./types";
import { pagePath, parseLivePath, todayAccraDate } from "./paths";
import {
  LiveValidationError,
  assertBullets, assertByline, assertDate, assertEntryBody, assertEntryTitle,
  assertHeadline, assertSlug, assertHttpsUrl, assertAlt, assertCaption,
} from "./validation";

type FileShape = { pages: LivePage[]; entries: LiveEntry[] };

function empty(): FileShape { return { pages: [], entries: [] }; }

function cryptoId(): string {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultStorePath(): string {
  return resolve(process.env.LIVE_PAGES_STORE || ".live-pages.local.json");
}

export class FileLiveStore implements LiveStore {
  private file: string;
  constructor(file = defaultStorePath()) {
    this.file = file;
  }

  private load(): FileShape {
    if (!existsSync(this.file)) return empty();
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8"));
      return { pages: raw.pages || [], entries: raw.entries || [] };
    } catch {
      return empty();
    }
  }

  private save(data: FileShape): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(data, null, 2) + "\n");
  }

  private resolvePage(data: FileShape, slugOrPath: string): LivePage {
    const path = parseLivePath(slugOrPath);
    if (path) {
      const page = data.pages.find((p) => p.path === slugOrPath || (p.slug === path.slug && p.slug_date === path.date));
      if (!page) throw new LiveValidationError(`No live page at ${slugOrPath}`);
      return page;
    }
    const slug = assertSlug(slugOrPath);
    const matches = data.pages.filter((p) => p.slug === slug);
    const live = matches.filter((p) => p.status === "live");
    const page = (live[0] || matches.sort((a, b) => b.slug_date.localeCompare(a.slug_date))[0]);
    if (!page) throw new LiveValidationError(`No live page with slug ${slug}`);
    return page;
  }

  private withEntries(page: LivePage, data: FileShape): LivePageWithEntries {
    const entries = data.entries
      .filter((e) => e.page_id === page.id)
      .sort((a, b) => (a.posted_at < b.posted_at ? 1 : a.posted_at > b.posted_at ? -1 : 0));
    return { ...page, entries };
  }

  async start(input: StartInput): Promise<LivePageWithEntries> {
    const slug = assertSlug(input.slug);
    const date = assertDate(input.date || todayAccraDate());
    const headline = assertHeadline(input.headline);
    const byline = assertByline(input.byline);
    const bullets = assertBullets(input.bullets);
    const title = assertEntryTitle(input.title);
    const body = assertEntryBody(input.body);
    const source_url = assertHttpsUrl("Source URL", input.sourceUrl);
    const image_url = assertHttpsUrl("Image URL", input.imageUrl);
    const image_alt = assertAlt(input.imageAlt, !!image_url);
    const image_caption = assertCaption(input.imageCaption);
    const data = this.load();
    if (data.pages.some((p) => p.slug === slug && p.status === "live")) {
      throw new LiveValidationError(`A live page with slug "${slug}" is already running`);
    }
    const path = pagePath(slug, date);
    if (data.pages.some((p) => p.path === path)) {
      throw new LiveValidationError(`A page already exists at /live/${path}`);
    }
    const now = new Date().toISOString();
    const page: LivePage = {
      id: cryptoId(),
      slug,
      slug_date: date,
      path,
      headline,
      byline,
      summary_bullets: bullets,
      status: "live",
      visibility: input.visibility === "hidden" ? "hidden" : "public",
      started_at: now,
      ended_at: null,
      content_updated_at: now,
      created_at: now,
    };
    const entry: LiveEntry = {
      id: cryptoId(),
      page_id: page.id,
      posted_at: now,
      title,
      body,
      source_url,
      source_label: input.sourceLabel?.trim() || null,
      image_url,
      image_alt,
      image_caption,
      is_wrapup: false,
      created_at: now,
      updated_at: now,
    };
    data.pages.push(page);
    data.entries.push(entry);
    this.save(data);
    return this.withEntries(page, data);
  }

  async add(input: AddInput): Promise<LiveEntry> {
    const data = this.load();
    const page = this.resolvePage(data, input.slug);
    if (page.status !== "live") throw new LiveValidationError("Cannot add an entry to a page that is not live");
    const now = new Date().toISOString();
    const entry: LiveEntry = {
      id: cryptoId(),
      page_id: page.id,
      posted_at: now,
      title: assertEntryTitle(input.title),
      body: assertEntryBody(input.body),
      source_url: assertHttpsUrl("Source URL", input.sourceUrl),
      source_label: input.sourceLabel?.trim() || null,
      image_url: assertHttpsUrl("Image URL", input.imageUrl),
      image_alt: assertAlt(input.imageAlt, !!input.imageUrl),
      image_caption: assertCaption(input.imageCaption),
      is_wrapup: false,
      created_at: now,
      updated_at: now,
    };
    page.content_updated_at = now;
    data.entries.push(entry);
    this.save(data);
    return entry;
  }

  async summary(input: SummaryInput): Promise<LivePage> {
    const data = this.load();
    const page = this.resolvePage(data, input.slug);
    if (page.status !== "live") throw new LiveValidationError("Cannot replace the summary on a page that is not live");
    page.summary_bullets = assertBullets(input.bullets);
    page.content_updated_at = new Date().toISOString();
    this.save(data);
    return page;
  }

  async edit(input: EditInput): Promise<LiveEntry> {
    const data = this.load();
    const page = this.resolvePage(data, input.slug);
    const entry = data.entries.find((e) => e.id === input.entryId && e.page_id === page.id);
    if (!entry) throw new LiveValidationError("Entry not found on that page");
    if (input.title != null) entry.title = assertEntryTitle(input.title);
    if (input.body != null) entry.body = assertEntryBody(input.body);
    if (input.sourceUrl !== undefined) entry.source_url = assertHttpsUrl("Source URL", input.sourceUrl);
    if (input.sourceLabel !== undefined) entry.source_label = input.sourceLabel?.trim() || null;
    if (input.imageUrl !== undefined) {
      entry.image_url = assertHttpsUrl("Image URL", input.imageUrl);
      entry.image_alt = assertAlt(input.imageAlt ?? entry.image_alt, !!entry.image_url);
    } else if (input.imageAlt !== undefined) {
      entry.image_alt = assertAlt(input.imageAlt, !!entry.image_url);
    }
    if (input.imageCaption !== undefined) entry.image_caption = assertCaption(input.imageCaption);
    const now = new Date().toISOString();
    entry.updated_at = now;
    page.content_updated_at = now;
    this.save(data);
    return entry;
  }

  async end(input: EndInput): Promise<LivePageWithEntries> {
    const data = this.load();
    const page = this.resolvePage(data, input.slug);
    if (page.status !== "live") throw new LiveValidationError("Page is not live");
    const now = new Date().toISOString();
    const entry: LiveEntry = {
      id: cryptoId(),
      page_id: page.id,
      posted_at: now,
      title: assertEntryTitle(input.title),
      body: assertEntryBody(input.body),
      source_url: null,
      source_label: null,
      image_url: null,
      image_alt: null,
      image_caption: null,
      is_wrapup: true,
      created_at: now,
      updated_at: now,
    };
    page.status = "ended";
    page.ended_at = now;
    page.content_updated_at = now;
    data.entries.push(entry);
    this.save(data);
    return this.withEntries(page, data);
  }

  async getByPath(path: string, opts?: { includeHidden?: boolean; includeDraft?: boolean }): Promise<LivePageWithEntries | null> {
    const data = this.load();
    const page = data.pages.find((p) => p.path === path);
    if (!page) return null;
    if (page.status === "draft" && !opts?.includeDraft) return null;
    if (page.visibility === "hidden" && !opts?.includeHidden) return null;
    return this.withEntries(page, data);
  }

  async listPublic(): Promise<LivePage[]> {
    const data = this.load();
    return data.pages
      .filter((p) => p.visibility === "public" && (p.status === "live" || p.status === "ended"))
      .sort((a, b) => (a.content_updated_at < b.content_updated_at ? 1 : -1));
  }

  async listLiveBanner(): Promise<LiveBannerItem[]> {
    const data = this.load();
    return data.pages
      .filter((p) => p.visibility === "public" && p.status === "live")
      .sort((a, b) => (a.content_updated_at < b.content_updated_at ? 1 : -1))
      .map((p) => ({
        path: p.path,
        headline: p.headline,
        content_updated_at: p.content_updated_at,
        started_at: p.started_at,
      }));
  }
}
