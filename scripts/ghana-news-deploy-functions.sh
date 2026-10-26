#!/usr/bin/env bash
# Assemble StatsGH (as-is) + GhanaCrimes (prefixed gc-, _shared -> _gc_shared) edge functions into one
# Supabase project (ghana-news, ref rscqxztgtpcifcqxjskh) and deploy them all.
set -euo pipefail
S=/workspace/sites/statsgh/supabase; G=/workspace/sites/ghana-crime-watch/supabase; D=/workspace/deploy
rm -rf $D/supabase/functions && mkdir -p $D/supabase/functions
cp -r $S/functions/* $D/supabase/functions/
cp -r $G/functions/_shared $D/supabase/functions/_gc_shared
for d in $G/functions/*/; do n=$(basename $d); [ $n = _shared ] && continue; cp -r $d $D/supabase/functions/gc-$n; done
grep -rl '\.\./_shared/' $D/supabase/functions/gc-* | xargs -r sed -i 's#\.\./_shared/#../_gc_shared/#g'
cd $D && SUPABASE_ACCESS_TOKEN=$(cat /workspace/tools/.sb_token) /workspace/tools/supabase functions deploy --project-ref rscqxztgtpcifcqxjskh --use-api
