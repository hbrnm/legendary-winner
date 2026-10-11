#!/bin/sh
# Construiește aplicația conectată la Supabase-ul local (scripts/local-supabase.mjs)
# în out-cloud/, pentru testele E2E ale modului cloud. Build-ul obișnuit (out/) rămâne în mod demonstrativ.
set -e
ANON=$(node -e 'import("./scripts/local-supabase-keys.mjs").then(m=>console.log(m.ANON_KEY))')
rm -rf out-cloud
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" npx next build
node scripts/build-sw.mjs
mv out out-cloud
