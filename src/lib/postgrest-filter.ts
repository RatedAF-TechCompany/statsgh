/**
 * Make free text safe to embed in a PostgREST `.or()` / `ilike` filter.
 * PostgREST treats , ( ) as filter syntax and " \ as quoting, and % _ * as LIKE wildcards,
 * so a query such as "Accra, Kumasi" used to break the filter (400 PGRST100).
 * Returns a quoted ilike pattern: "%term%" with reserved characters escaped.
 */
export function ilikePattern(input: string): string {
  const cleaned = input
    .normalize("NFKC")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, 100)
    .replace(/[%_*\\]/g, (c) => `\\${c}`) // LIKE wildcards + backslash literal
    .replace(/"/g, '\\"');
  return `"%${cleaned}%"`;
}

/** Build an `.or()` string matching the term against several columns with ilike. */
export function ilikeOr(columns: string[], input: string): string {
  const p = ilikePattern(input);
  return columns.map((c) => `${c}.ilike.${p}`).join(",");
}

/** Split a query on commas/semicolons into up to 5 terms and OR every term across the columns. */
export function ilikeOrTerms(columns: string[], input: string): string {
  const terms = input.split(/[,;]+/).map((t) => t.trim()).filter((t) => t.length >= 2).slice(0, 5);
  if (!terms.length) return ilikeOr(columns, input);
  return terms.map((t) => ilikeOr(columns, t)).join(",");
}
