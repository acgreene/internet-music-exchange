import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@ime/client-env';

let sharedClient: SupabaseClient | undefined;

/**
 * The client-side Supabase client, used for auth only: it owns session
 * persistence, automatic token refresh, and multi-tab sync. Points at whatever
 * project the environment names.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!sharedClient) {
    sharedClient = createClient(
      clientEnv.SUPABASE_URL,
      clientEnv.SUPABASE_ANON_KEY,
    );
  }
  return sharedClient;
}
