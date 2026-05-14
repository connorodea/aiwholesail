// ===========================================================================
// NOT IN USE — DO NOT WIRE THIS UP
// ===========================================================================
// AIWholesail does NOT use Supabase. The active backend is Express on port
// 3202 + Postgres + Stripe + Resend on hetznerCO (see memory/
// reference_aiwholesail_infra.md for the canonical infra map).
//
// This file is leftover from the Lovable starter template. The only remaining
// importer in the active codebase is src/lib/zillow-api.ts, which imports
// `supabase` for a code path gated on VITE_USE_SUPABASE_ZILLOW='true' that is
// OFF in production. Despite that, the import at module-top causes
// createClient() to run on every page load — instantiating an unused client
// with autoRefreshToken+persistSession+localStorage storage. Bundle weight
// ~70KB.
//
// Planned removal: full cleanup PR (strip the zillow-api.ts import, delete
// the four orphaned *.supabase.{ts,tsx} variants in src/contexts/ and
// src/hooks/, drop @supabase/supabase-js from package.json). Tracked as
// debt; not done yet because nobody has had the cycles to verify nothing
// else depends on it.
//
// If you're debugging an auth/session issue: this file is not the culprit,
// but its presence in the bundle has historically caused confusion. Ask
// Connor (connor@aiwholesail.com) before touching.
// ===========================================================================
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://ztgsevhzbeywytoqlsbf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z3Nldmh6YmV5d3l0b3Fsc2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDk2NTUsImV4cCI6MjA2OTkyNTY1NX0.YZLP7_Tpbk9BwScdN1zV6VBPfa19voOSgR76cn3ll9w";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});