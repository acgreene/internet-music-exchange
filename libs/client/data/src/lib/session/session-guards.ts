import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, of, take } from 'rxjs';
import { SessionService } from './session.service';

/**
 * Wait until the session is known, then decide. A server render never knows
 * who is signed in, so it renders the page and the browser decides.
 */
function whenKnown(decide: (signedIn: boolean) => boolean | string) {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return of(true);
  return toObservable(session.status).pipe(
    filter((status) => status !== 'loading'),
    take(1),
    map((status) => {
      const decision = decide(status === 'signed-in');
      return typeof decision === 'string'
        ? router.parseUrl(decision)
        : decision;
    }),
  );
}

/**
 * Only signed-in users; anyone else signs in first and comes back.
 */
export const signedInGuard: CanActivateFn = (_route, state) =>
  whenKnown((signedIn) =>
    signedIn ? true : `/sign-in?returnUrl=${encodeURIComponent(state.url)}`,
  );

/**
 * Only signed-out visitors, for sign-in and sign-up; others go home.
 */
export const signedOutGuard: CanActivateFn = () =>
  whenKnown((signedIn) => (signedIn ? '/' : true));

/**
 * Only platform admins.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  return whenKnown((signedIn) => {
    if (!signedIn) return `/sign-in?returnUrl=${encodeURIComponent(state.url)}`;
    return session.isAdmin() ? true : '/';
  });
};
