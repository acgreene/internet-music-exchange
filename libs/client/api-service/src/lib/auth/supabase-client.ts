import { isDevMode } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Local Supabase stack (supabase start); the publishable key is the shared
// CLI default and safe to embed.
const DEVELOPMENT_URL = 'http://127.0.0.1:54331';
const DEVELOPMENT_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Placeholders until a production deployment exists; set the hosted project's
// URL and publishable key here.
const PRODUCTION_URL = '';
const PRODUCTION_ANON_KEY = '';

let sharedClient: SupabaseClient | undefined;

/**
 * The client-side Supabase client, used for auth only: it owns session
 * persistence, automatic token refresh, and multi-tab sync. Postgres access
 * always goes through the API. Created lazily so nothing touches browser
 * storage until auth is actually used.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!sharedClient) {
    sharedClient = isDevMode()
      ? createClient(DEVELOPMENT_URL, DEVELOPMENT_ANON_KEY)
      : createClient(PRODUCTION_URL, PRODUCTION_ANON_KEY);
  }
  return sharedClient;
}
