// BBC-style developing-story update box. Server/client safe (no DOM access).
export type StoryUpdate = {
  id: string;
  posted_at: string;
  summary: string;
  body_md: string | null;
  sources: string[] | null;
  kind: "update" | "correction" | string;
};

const ukDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(new Date(iso));

export function PublishedUpdatedLine({ publishedAt, contentUpdatedAt }: { publishedAt?: string | null; contentUpdatedAt?: string | null }) {
  if (!publishedAt) return null;
  const showUpdated = contentUpdatedAt && new Date(contentUpdatedAt).getTime() - new Date(publishedAt).getTime() > 60_000;
  return (
    <span className="font-ui text-xs text-[#5B5B5B]">
      Published <time dateTime={publishedAt} itemProp="datePublished">{ukDateTime(publishedAt)} UK</time>
      {showUpdated && <> · Updated <time dateTime={contentUpdatedAt!} itemProp="dateModified">{ukDateTime(contentUpdatedAt!)} UK</time></>}
    </span>
  );
}

function Item({ u, label }: { u: StoryUpdate; label: string }) {
  return (
    <li className="py-2 border-b border-[#E5E5E5] last:border-0">
      <p className="font-ui text-[14px] text-[#1A1A1A]">
        <strong>{label}, {ukDateTime(u.posted_at)} UK:</strong> {u.summary}
      </p>
      {u.body_md && <p className="font-ui text-[13px] text-[#3A3A3A] mt-1 whitespace-pre-line">{u.body_md}</p>}
    </li>
  );
}

export function StoryUpdates({ updates }: { updates?: StoryUpdate[] | null }) {
  if (!updates || updates.length === 0) return null;
  const sorted = [...updates].sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  const ups = sorted.filter((u) => u.kind !== "correction");
  const corr = sorted.filter((u) => u.kind === "correction");
  return (
    <>
      {ups.length > 0 && (
        <section aria-label="Latest updates" className="mb-6 border-l-4 border-[#B80000] bg-[#FAFAFA] px-4 py-3">
          <h2 className="font-ui text-xs font-bold uppercase tracking-wide text-[#B80000] mb-1">Latest updates</h2>
          <ul>{ups.map((u) => <Item key={u.id} u={u} label="Updated" />)}</ul>
        </section>
      )}
      {corr.length > 0 && (
        <section aria-label="Corrections" className="mb-6 border-l-4 border-[#5B5B5B] bg-[#F5F5F5] px-4 py-3">
          <ul>{corr.map((u) => <Item key={u.id} u={u} label="Correction" />)}</ul>
        </section>
      )}
    </>
  );
}
