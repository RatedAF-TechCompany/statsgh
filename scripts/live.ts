#!/usr/bin/env node
/**
 * StatsGH live coverage publisher.
 * Secrets are read from the environment only (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * optional REVALIDATE_SECRET, SITE_ORIGIN). Never print secret values.
 *
 *   npx tsx scripts/live.ts START <slug> --headline "..." --byline "..." --bullets "A | B | C" --title "..." --body "..."
 *   npx tsx scripts/live.ts ADD <slug> --title "..." --body "..." [--source URL] [--source-label "..."] [--image URL --image-alt "..." --image-caption "..."]
 *   npx tsx scripts/live.ts SUMMARY <slug> --bullets "A | B | C | D"
 *   npx tsx scripts/live.ts EDIT <slug> <entry-id> [--title "..."] [--body "..."]
 *   npx tsx scripts/live.ts END <slug> --title "..." --body "..."
 *
 * Local preview uses LIVE_PAGES_ADAPTER=file and optional LIVE_PAGES_STORE (JSON path).
 * <slug> may be the short slug or the full path (slug-YYYY-MM-DD).
 */
import { getLiveStore } from "../src/lib/live/store";
import { pingLiveRevalidate } from "../src/lib/live/commands";
import { parseBulletArg, LiveValidationError } from "../src/lib/live/validation";
import { liveUrl } from "../src/lib/live/paths";

function usage(): string {
  return `Usage:
  live.ts START <slug> --headline "..." --byline "..." --bullets "A | B | C" --title "..." --body "..."
           [--source URL] [--source-label "..."] [--image URL --image-alt "..." --image-caption "..."]
           [--hidden] [--date YYYY-MM-DD]
  live.ts ADD <slug> --title "..." --body "..." [--source URL] [--source-label "..."]
           [--image URL --image-alt "..." --image-caption "..."]
  live.ts SUMMARY <slug> --bullets "A | B | C"
  live.ts EDIT <slug> <entry-id> [--title "..."] [--body "..."] [--source URL] [--image URL --image-alt "..."]
           [--clear-source] [--clear-image]
  live.ts END <slug> --title "..." --body "..."

Bullets: 3–5 items, separated by " | " or newlines. Headlines and entry titles must not contain a colon.
Secrets are read from env only.`;
}

function arg(flag: string, argv: string[]): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  return argv[i + 1];
}
function has(flag: string, argv: string[]): boolean {
  return argv.includes(flag);
}

async function main() {
  const argv = process.argv.slice(2);
  const rawCmd = (argv[0] || "").toUpperCase();
  const cmd = rawCmd === "LIVE" ? (argv[1] || "").toUpperCase() : rawCmd;
  const rest = rawCmd === "LIVE" ? argv.slice(2) : argv.slice(1);
  if (!cmd || cmd === "-H" || cmd === "--HELP" || cmd === "HELP") {
    console.log(usage());
    process.exit(0);
  }

  const store = await getLiveStore();
  let pathForRevalidate: string | undefined;
  let out: unknown;

  try {
    if (cmd === "START") {
      const slug = rest[0];
      if (!slug || slug.startsWith("-")) throw new LiveValidationError("START requires a slug");
      const body = arg("--body", rest);
      const bullets = arg("--bullets", rest);
      if (!arg("--headline", rest) || !arg("--byline", rest) || !bullets || !arg("--title", rest) || !body) {
        throw new LiveValidationError("START requires --headline, --byline, --bullets, --title and --body");
      }
      const page = await store.start({
        slug,
        headline: arg("--headline", rest)!,
        byline: arg("--byline", rest)!,
        bullets: parseBulletArg(bullets),
        title: arg("--title", rest)!,
        body,
        sourceUrl: arg("--source", rest),
        sourceLabel: arg("--source-label", rest),
        imageUrl: arg("--image", rest),
        imageAlt: arg("--image-alt", rest),
        imageCaption: arg("--image-caption", rest),
        visibility: has("--hidden", rest) ? "hidden" : "public",
        date: arg("--date", rest),
      });
      pathForRevalidate = page.path;
      out = { ok: true, url: liveUrl(page.path), page };
    } else if (cmd === "ADD") {
      const slug = rest[0];
      if (!slug || slug.startsWith("-")) throw new LiveValidationError("ADD requires a slug");
      if (!arg("--title", rest) || !arg("--body", rest)) throw new LiveValidationError("ADD requires --title and --body");
      const entry = await store.add({
        slug,
        title: arg("--title", rest)!,
        body: arg("--body", rest)!,
        sourceUrl: arg("--source", rest),
        sourceLabel: arg("--source-label", rest),
        imageUrl: arg("--image", rest),
        imageAlt: arg("--image-alt", rest),
        imageCaption: arg("--image-caption", rest),
      });
      pathForRevalidate = slug;
      out = { ok: true, entry };
    } else if (cmd === "SUMMARY") {
      const slug = rest[0];
      if (!slug || slug.startsWith("-")) throw new LiveValidationError("SUMMARY requires a slug");
      const bullets = arg("--bullets", rest);
      if (!bullets) throw new LiveValidationError("SUMMARY requires --bullets");
      const page = await store.summary({ slug, bullets: parseBulletArg(bullets) });
      pathForRevalidate = page.path;
      out = { ok: true, page };
    } else if (cmd === "EDIT") {
      const slug = rest[0];
      const entryId = rest[1];
      if (!slug || !entryId || slug.startsWith("-") || entryId.startsWith("-")) {
        throw new LiveValidationError("EDIT requires a slug and an entry id");
      }
      const entry = await store.edit({
        slug,
        entryId,
        title: arg("--title", rest),
        body: arg("--body", rest),
        sourceUrl: has("--clear-source", rest) ? null : arg("--source", rest),
        sourceLabel: has("--clear-source", rest) ? null : arg("--source-label", rest),
        imageUrl: has("--clear-image", rest) ? null : arg("--image", rest),
        imageAlt: has("--clear-image", rest) ? null : arg("--image-alt", rest),
        imageCaption: has("--clear-image", rest) ? null : arg("--image-caption", rest),
      });
      pathForRevalidate = slug;
      out = { ok: true, entry };
    } else if (cmd === "END") {
      const slug = rest[0];
      if (!slug || slug.startsWith("-")) throw new LiveValidationError("END requires a slug");
      if (!arg("--title", rest) || !arg("--body", rest)) throw new LiveValidationError("END requires --title and --body");
      const page = await store.end({ slug, title: arg("--title", rest)!, body: arg("--body", rest)! });
      pathForRevalidate = page.path;
      out = { ok: true, url: liveUrl(page.path), page };
    } else {
      console.error(usage());
      process.exit(2);
    }
  } catch (e: unknown) {
    const msg = e instanceof LiveValidationError || (e instanceof Error && e.name === "LiveValidationError") ? (e as Error).message : (e instanceof Error ? e.message : String(e));
    console.error(msg);
    process.exit(e instanceof LiveValidationError ? 2 : 1);
  }

  const rev = await pingLiveRevalidate(pathForRevalidate);
  console.log(JSON.stringify({ ...(out as object), revalidate: rev }, null, 2));
}

main();
