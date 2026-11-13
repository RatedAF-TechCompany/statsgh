/** Public shape of a StatsGH live coverage page and its feed entries. */

export type LiveStatus = "draft" | "live" | "ended";
export type LiveVisibility = "public" | "hidden";

export type LivePage = {
  id: string;
  slug: string;
  slug_date: string; // YYYY-MM-DD (Africa/Accra = GMT all year)
  path: string; // `${slug}-${slug_date}`
  headline: string;
  byline: string;
  summary_bullets: string[];
  status: LiveStatus;
  visibility: LiveVisibility;
  started_at: string | null;
  ended_at: string | null;
  content_updated_at: string;
  created_at: string;
};

export type LiveEntry = {
  id: string;
  page_id: string;
  posted_at: string;
  title: string;
  body: string; // sanitised HTML
  source_url: string | null;
  source_label: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_caption: string | null;
  is_wrapup: boolean;
  created_at: string;
  updated_at: string;
};

export type LivePageWithEntries = LivePage & { entries: LiveEntry[] };

export type LiveBannerItem = {
  path: string;
  headline: string;
  content_updated_at: string;
  started_at: string | null;
};

export type StartInput = {
  slug: string;
  headline: string;
  byline: string;
  bullets: string[];
  title: string;
  body: string;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
  visibility?: LiveVisibility;
  date?: string; // YYYY-MM-DD, defaults to today in Accra/GMT
};

export type AddInput = {
  slug: string; // slug or full path
  title: string;
  body: string;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
};

export type SummaryInput = { slug: string; bullets: string[] };

export type EditInput = {
  slug: string;
  entryId: string;
  title?: string;
  body?: string;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
};

export type EndInput = { slug: string; title: string; body: string };

export interface LiveStore {
  start(input: StartInput): Promise<LivePageWithEntries>;
  add(input: AddInput): Promise<LiveEntry>;
  summary(input: SummaryInput): Promise<LivePage>;
  edit(input: EditInput): Promise<LiveEntry>;
  end(input: EndInput): Promise<LivePageWithEntries>;
  getByPath(path: string, opts?: { includeHidden?: boolean; includeDraft?: boolean }): Promise<LivePageWithEntries | null>;
  listPublic(): Promise<LivePage[]>;
  listLiveBanner(): Promise<LiveBannerItem[]>;
}
