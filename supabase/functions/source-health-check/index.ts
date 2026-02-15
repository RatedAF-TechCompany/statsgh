import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Curated watchlist of known Ghana news RSS feeds to try auto-adding
const DISCOVERY_WATCHLIST = [
  { name: "Africa Briefing Ghana", rss_url: "https://africabriefing.org/category/west-africa/ghana/feed/" },
  { name: "Business & Financial Times", rss_url: "https://thebftonline.com/category/news/feed/" },
  { name: "Chronicle Ghana", rss_url: "https://thechronicle.com.gh/feed/" },
  { name: "ClassFM Business", rss_url: "https://www.classfmonline.com/business/feed/" },
  { name: "Daily Graphic Online", rss_url: "https://www.graphic.com.gh/news/feed/" },
  { name: "DailyHerald Ghana", rss_url: "https://dailyheraldgh.com/feed/" },
  { name: "Energy Ghana", rss_url: "https://energyghana.com/feed/" },
  { name: "Ghanaian Observer", rss_url: "https://www.ghanaianobserver.com/feed/" },
  { name: "GhanaWeb General", rss_url: "https://www.ghanaweb.com/GhanaHomePage/NewsArchive/rss.xml" },
  { name: "Graphic Online General", rss_url: "https://www.graphic.com.gh/feed/" },
  { name: "Herald Ghana", rss_url: "https://theheraldghana.com/feed/" },
  { name: "JoyNews Online", rss_url: "https://www.myjoyonline.com/news/feed/" },
  { name: "Kumasi24", rss_url: "https://kumasi24.com/feed/" },
  { name: "MyNewsGh", rss_url: "https://www.mynewsgh.com/feed/" },
  { name: "Norvan Reports", rss_url: "https://norvanreports.com/feed/" },
  { name: "Oil City Ghana", rss_url: "https://oilcityghana.com/feed/" },
  { name: "Peacefm Politics", rss_url: "https://www.peacefmonline.com/pages/politics/rss.xml" },
  { name: "Prime News Ghana", rss_url: "https://www.primenewsghana.com/feed/" },
  { name: "The Independent Ghana", rss_url: "https://theindependentghana.com/feed/" },
  { name: "Today Ghana", rss_url: "https://www.todaygh.com/feed/" },
  { name: "UTV Ghana Online", rss_url: "https://www.utvghana.com/feed/" },
];

async function testRssFeed(url: string, timeoutMs = 10000): Promise<{ ok: boolean; itemCount: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'StatsGH-HealthCheck/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, text/html',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false, itemCount: 0, error: `HTTP ${res.status}` };

    const text = await res.text();
    
    // Check if it looks like RSS/XML or has usable content
    const isRss = text.includes('<rss') || text.includes('<feed') || text.includes('<item') || text.includes('<entry');
    // GhanaWeb uses HTML scraping, count article links
    const isHtmlWithArticles = text.includes('<a href=') && text.length > 5000;

    if (!isRss && !isHtmlWithArticles) {
      return { ok: false, itemCount: 0, error: 'Not RSS/XML and no scrapeable content' };
    }

    // Count items
    const itemMatches = text.match(/<item[\s>]/g) || text.match(/<entry[\s>]/g) || [];
    return { ok: true, itemCount: itemMatches.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, itemCount: 0, error: msg.includes('abort') ? 'Timeout' : msg };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results = {
    testedActive: 0,
    deactivated: [] as string[],
    reactivated: [] as string[],
    newSourcesAdded: [] as string[],
    newSourcesFailed: [] as string[],
    errors: [] as string[],
  };

  try {
    // ── PHASE 1: Health-check all active sources ──
    console.log('Phase 1: Testing active sources...');
    const { data: activeSources } = await supabase
      .from('newsroom_sources')
      .select('id, name, rss_url, consecutive_errors')
      .eq('is_active', true);

    if (activeSources) {
      for (const source of activeSources) {
        results.testedActive++;
        const test = await testRssFeed(source.rss_url);
        
        if (!test.ok) {
          const newErrors = (source.consecutive_errors || 0) + 1;
          // Deactivate after 3 consecutive failures (across multiple runs)
          if (newErrors >= 3) {
            await supabase.from('newsroom_sources').update({
              is_active: false,
              consecutive_errors: newErrors,
              last_error_at: new Date().toISOString(),
              last_error_message: `Auto-deactivated after ${newErrors} consecutive failures: ${test.error}`,
            }).eq('id', source.id);
            results.deactivated.push(source.name);
            console.log(`Deactivated: ${source.name} (${test.error})`);
          } else {
            await supabase.from('newsroom_sources').update({
              consecutive_errors: newErrors,
              last_error_at: new Date().toISOString(),
              last_error_message: test.error || 'Feed test failed',
            }).eq('id', source.id);
          }
        } else {
          // Reset errors on success
          if ((source.consecutive_errors || 0) > 0) {
            await supabase.from('newsroom_sources').update({
              consecutive_errors: 0,
              last_error_message: null,
            }).eq('id', source.id);
          }
        }
      }
    }

    // ── PHASE 2: Try to reactivate previously broken sources ──
    console.log('Phase 2: Testing inactive sources for recovery...');
    const { data: inactiveSources } = await supabase
      .from('newsroom_sources')
      .select('id, name, rss_url')
      .eq('is_active', false);

    if (inactiveSources) {
      for (const source of inactiveSources) {
        const test = await testRssFeed(source.rss_url);
        if (test.ok && test.itemCount > 0) {
          await supabase.from('newsroom_sources').update({
            is_active: true,
            consecutive_errors: 0,
            last_error_message: null,
            last_success_at: new Date().toISOString(),
          }).eq('id', source.id);
          results.reactivated.push(source.name);
          console.log(`Reactivated: ${source.name} (${test.itemCount} items)`);
        }
      }
    }

    // ── PHASE 3: Discover and add new sources from watchlist ──
    console.log('Phase 3: Discovering new sources...');
    const { data: existingSources } = await supabase
      .from('newsroom_sources')
      .select('rss_url');
    
    const existingUrls = new Set((existingSources || []).map(s => s.rss_url.toLowerCase().replace(/\/$/, '')));

    for (const candidate of DISCOVERY_WATCHLIST) {
      const normalizedUrl = candidate.rss_url.toLowerCase().replace(/\/$/, '');
      if (existingUrls.has(normalizedUrl)) continue;

      const test = await testRssFeed(candidate.rss_url);
      if (test.ok && test.itemCount >= 3) {
        const { error } = await supabase.from('newsroom_sources').insert({
          name: candidate.name,
          rss_url: candidate.rss_url,
          is_active: true,
          consecutive_errors: 0,
        });
        if (!error) {
          results.newSourcesAdded.push(`${candidate.name} (${test.itemCount} items)`);
          existingUrls.add(normalizedUrl);
          console.log(`Added new source: ${candidate.name}`);
        } else {
          results.errors.push(`Insert failed for ${candidate.name}: ${error.message}`);
        }
      } else {
        results.newSourcesFailed.push(`${candidate.name}: ${test.error || 'too few items'}`);
      }
    }

    console.log('Health check complete:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Source health check error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
