
- Market/indicator widgets must label fixed-estimate sources and stale prices via `src/lib/dataProvenance.ts`, never present them as live — keeps numbers honest.
- Public article source links come from the `get_article_source` RPC, not direct reads of the admin-only newsroom table — preserves RLS.
- Market prices are written only by `market-data-refresh` (hourly cron) from real feeds (open.er-api, FRED, GSE kwayisi), stamped with source + observation time; never insert estimates — keeps numbers honest.
