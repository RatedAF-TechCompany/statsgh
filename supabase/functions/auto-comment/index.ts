// Disabled 2026-11-02 (audit): this endpoint was public (no auth) and published AI-written comments under
// invented Ghanaian names with is_published=true. Fake reader comments mislead readers, so it now does nothing.
// The previous code is in git history (before the audit commit).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
serve(() => new Response(JSON.stringify({ error: "auto-comment is disabled" }), { status: 410, headers: { "Content-Type": "application/json" } }));
