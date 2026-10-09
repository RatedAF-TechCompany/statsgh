// Plain-text parsing of master prompt v3 output. Pure, testable.
export const NO_QUALIFYING = "No qualifying article is available.";
export const REPLY_MARKER = "---REPLY---";
export const SITE = "https://www.statsgh.com";
export const articleUrl = (a: { category_slug: string; slug: string }) => `${SITE}/${a.category_slug}/${a.slug}`;
export const buildReply = (a: { category_slug: string; slug: string }) => `Source: ${articleUrl(a)}`;

export interface ParsedV3 {
  kind: "no_qualifying" | "post" | "empty";
  post: string;              // main post only (never contains the reply / Source line)
  modelReply: string | null; // whatever the model wrote after ---REPLY--- (audit only; never posted)
  markerFound: boolean;
  warnings: string[];
}

const SOURCE_LINE_RE = /^\s*(First reply:\s*)?Source:/i;

export function parseV3Output(content: string): ParsedV3 {
  const warnings: string[] = [];
  let s = (content ?? "").replace(/\r\n?/g, "\n");
  const fence = s.trim().match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  if (fence) s = fence[1];
  s = s.trim();
  if (s === "") return { kind: "empty", post: "", modelReply: null, markerFound: false, warnings };
  if (s === NO_QUALIFYING) return { kind: "no_qualifying", post: NO_QUALIFYING, modelReply: null, markerFound: false, warnings };

  const lines = s.split("\n");
  const idx = lines.findIndex((l) => l.trim() === REPLY_MARKER);
  let postLines: string[];
  let modelReply: string | null = null;
  const markerFound = idx >= 0;
  if (markerFound) {
    postLines = lines.slice(0, idx);
    modelReply = lines.slice(idx + 1).join("\n").trim();
  } else {
    postLines = lines;
    warnings.push("reply_marker_missing");
  }

  // Strip any trailing Source / First reply lines: the reply is always built by code.
  for (;;) {
    let last = postLines.length - 1;
    while (last >= 0 && postLines[last].trim() === "") last--;
    if (last < 0 || !SOURCE_LINE_RE.test(postLines[last])) break;
    postLines = postLines.slice(0, last);
    warnings.push("source_line_stripped_from_post");
  }

  const post = postLines.map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (post === NO_QUALIFYING) return { kind: "no_qualifying", post, modelReply, markerFound, warnings };
  if (post === "") return { kind: "empty", post, modelReply, markerFound, warnings };
  return { kind: "post", post, modelReply, markerFound, warnings };
}
