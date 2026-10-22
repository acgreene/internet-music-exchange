import type { Route } from '@angular/router';
import { signedInGuard } from '@ime/client-data';

/**
 * The listening pages, for an app to place inside its own frame.
 */
export const listeningRoutes: Route[] = [
  {
    path: '',
    title: 'IME',
    loadComponent: () =>
      import('./discover/discover-page').then((m) => m.DiscoverPage),
  },
  {
    path: 'search',
    title: 'Search · IME',
    loadComponent: () =>
      import('./search/search-page').then((m) => m.SearchPage),
  },
  {
    path: 'following',
    title: 'Following · IME',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./follow/following-page').then((m) => m.FollowingPage),
  },
  {
    path: 'artists/:handle',
    title: 'Artist · IME',
    loadComponent: () =>
      import('./artists/artist-page').then((m) => m.ArtistPage),
  },
  {
    path: 'artists/:handle/:slug',
    title: 'Release · IME',
    loadComponent: () =>
      import('./releases/release-page').then((m) => m.ReleasePage),
  },
];
