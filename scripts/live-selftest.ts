/**
 * Offline lifecycle test against the file store. No production database is touched.
 * Creates a hidden test page, exercises start/add/summary/edit/end, JSON-LD, banner on/off,
 * colon rejection, then deletes the store file.
 */
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileLiveStore } from "../src/lib/live/file-store";
import { liveBlogJsonLd, assertLiveBlogJsonLd } from "../src/lib/live/jsonld";
import { formatUpdatedAgo } from "../src/lib/live/format";
import { LiveValidationError } from "../src/lib/live/validation";
import { liveUrl } from "../src/lib/live/paths";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "statsgh-live-"));
  const file = join(dir, "store.json");
  const store = new FileLiveStore(file);
  let failed = 0;

  try {
    try {
      await store.start({
        slug: "test-live-preview",
        headline: "This headline has a colon: it must be rejected",
        byline: "Abubakar Saddique",
        bullets: ["One", "Two", "Three"],
        title: "Opening",
        body: "The test coverage has opened in Accra.",
        visibility: "hidden",
      });
      throw new Error("colon headline should have been rejected");
    } catch (e) {
      assert(e instanceof LiveValidationError, "expected LiveValidationError for colon");
    }

    const started = await store.start({
      slug: "test-live-preview",
      headline: "StatsGH tests a hidden live coverage page",
      byline: "Abubakar Saddique",
      bullets: [
        "This is a hidden test page and must stay noindex",
        "The feed should accept a second entry",
        "Ending the page must stop the live badge logic",
      ],
      title: "The test page is now live",
      body: "The hidden test coverage has started. This paragraph is only for local preview.",
      visibility: "hidden",
      date: "2026-11-13",
    });
    assert(started.path === "test-live-preview-2026-11-13", started.path);
    assert(started.status === "live", "should be live");
    assert(started.visibility === "hidden", "should be hidden");
    assert(started.entries.length === 1, "first entry");
    assert(liveUrl(started.path) === "https://www.statsgh.com/live/test-live-preview-2026-11-13", "url");

    const bannerWhileHidden = await store.listLiveBanner();
    assert(bannerWhileHidden.length === 0, "hidden pages must not appear on the homepage banner");
    const publicIndex = await store.listPublic();
    assert(publicIndex.length === 0, "hidden pages must not appear on /live");

    // A public page to exercise the banner on/off.
    const pub = await store.start({
      slug: "test-live-public",
      headline: "A public test briefing is under way in Accra",
      byline: "Abubakar Saddique",
      bullets: ["Public test bullet one", "Public test bullet two", "Public test bullet three"],
      title: "Coverage has begun",
      body: "This public test page exists only to check the homepage banner.",
      visibility: "public",
      date: "2026-11-13",
    });
    const bannerOn = await store.listLiveBanner();
    assert(bannerOn.some((b) => b.path === pub.path), "banner should list the public live page");

    const added = await store.add({
      slug: "test-live-preview",
      title: "A second entry has been posted",
      body: "A second short update is now on the feed.\n\nIt has two short paragraphs.",
      sourceUrl: "https://www.statsgh.com/about",
      sourceLabel: "About StatsGH",
    });
    const afterAdd = await store.getByPath(started.path, { includeHidden: true });
    assert(afterAdd && afterAdd.entries.length === 2, "two entries, newest first");
    assert(afterAdd!.entries[0].id === added.id, "newest first");

    const summed = await store.summary({
      slug: "test-live-preview",
      bullets: ["Bullet one updated", "Bullet two updated", "Bullet three updated", "Bullet four added"],
    });
    assert(summed.summary_bullets.length === 4, "summary replaced");

    const edited = await store.edit({
      slug: "test-live-preview",
      entryId: added.id,
      title: "A second entry has been clarified",
    });
    assert(edited.title === "A second entry has been clarified", "edit title");

    const ld = liveBlogJsonLd(afterAdd!);
    const errs = assertLiveBlogJsonLd(ld);
    assert(errs.length === 0, "JSON-LD: " + errs.join("; "));
    assert(ld["@type"] === "LiveBlogPosting", "type");
    assert(!!ld.coverageStartTime, "coverageStartTime");
    assert(!ld.coverageEndTime, "no end time while live");
    assert(ld.liveBlogUpdate.every((u) => u["@type"] === "BlogPosting"), "BlogPosting items");

    const endedHidden = await store.end({
      slug: "test-live-preview",
      title: "The hidden test has ended",
      body: "The hidden test coverage is closed and this wrap-up should be the latest entry.",
    });
    assert(endedHidden.status === "ended", "hidden ended");
    assert(endedHidden.entries[0].is_wrapup, "wrap-up first");
    const endedLd = liveBlogJsonLd(endedHidden);
    assert(!!endedLd.coverageEndTime, "coverageEndTime after end");

    const endedPub = await store.end({
      slug: "test-live-public",
      title: "The public test has ended",
      body: "The public test briefing has closed, so the homepage banner should disappear.",
    });
    assert(endedPub.status === "ended", "public ended");
    const bannerOff = await store.listLiveBanner();
    assert(bannerOff.length === 0, "banner disappears when every public page has ended");

    const ago = formatUpdatedAgo(new Date(Date.now() - 3 * 60_000).toISOString(), new Date());
    assert(ago === "Updated 3 minutes ago", ago);

    console.log("live-selftest: ok");
  } catch (e) {
    failed = 1;
    console.error("live-selftest: FAILED", e);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (existsSync(file)) console.error("store file was not removed");
  }
  process.exit(failed);
}

main();
