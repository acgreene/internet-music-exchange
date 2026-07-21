import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'designer-pages/releases/:releaseId',
    loadComponent: () =>
      import('./designer-page/designer-page').then((m) => m.DesignerPage),
    title: 'Designer page — Internet Music Exchange',
  },
];
