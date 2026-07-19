import { Injectable, signal } from '@angular/core';
import type { User } from '@ime/models';
import { toUser } from '../user/user-api';
import { getSupabaseClient } from './supabase-client';

/**
 * Client-side auth state: a signal of the signed-in user, kept in sync with
 * supabase-js auth events (sign-in, sign-out, refresh, session restore).
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly userSignal = signal<User | null>(null);
  private started = false;

  /**
   * The signed-in user, or null when signed out.
   */
  public readonly user = this.userSignal.asReadonly();

  /**
   * Begin tracking auth state. Call once from the browser (afterNextRender);
   * SSR renders as signed out.
   */
  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      this.userSignal.set(session ? toUser(session.user) : null);
    });
  }
}
