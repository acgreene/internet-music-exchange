import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Public pages render on the server, so links preview well and load fast.
 * Pages that need the signed-in user render in the browser, where the
 * session lives.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'account', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
