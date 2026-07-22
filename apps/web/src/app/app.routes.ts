import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'artist-pages/releases/:releaseId',
    loadComponent: () =>
      import('./artist-page/artist-page.component').then((m) => m.ArtistPage),
    title: 'Artist page // Internet Music Exchange',
  },
];
