import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@ime/client-env';

/**
 * Singleton authentication client, creates a single instance of the
 * Supabase client for client side applications to use.
 */
export class SupabaseSingleton {
  /**
   * The singleton instance of the auth client.
   * @private
   */
  private static instance: SupabaseSingleton | null = null;

  public readonly supabase: SupabaseClient;

  private constructor() {
    // sessions live only in the browser; a server render is always signed
    // out, and must never keep one user's session for the next request
    const inBrowser = typeof window !== 'undefined';
    this.supabase = createClient(
      clientEnv.SUPABASE_URL,
      clientEnv.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: inBrowser,
          autoRefreshToken: inBrowser,
          detectSessionInUrl: inBrowser,
        },
      },
    );
  }

  public static getInstance(): SupabaseSingleton {
    if (!SupabaseSingleton.instance) {
      SupabaseSingleton.instance = new SupabaseSingleton();
    }
    return SupabaseSingleton.instance;
  }
}
