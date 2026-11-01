#!/bin/sh
# Construiește aplicația conectată la Supabase-ul local (scripts/local-supabase.mjs)
# în out-cloud/, pentru testele E2E ale modului cloud. Delegat la scriptul portabil Node.js.
set -e
node "$(dirname "$0")/build-cloud-e2e.mjs"
