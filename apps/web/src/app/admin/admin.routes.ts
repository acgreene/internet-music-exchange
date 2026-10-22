import type { Route } from '@angular/router';
import { adminGuard } from '@ime/client-data';

/**
 * IME's own tools for its admins, web-only, in their own frame.
 */
export const adminRoutes: Route[] = [
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: '',
        title: 'Reports · Admin · IME',
        loadComponent: () => import('./queue-page').then((m) => m.QueuePage),
      },
      {
        path: 'cases/:targetType/:targetId',
        title: 'Case · Admin · IME',
        loadComponent: () => import('./case-page').then((m) => m.CasePage),
      },
      {
        path: 'billing',
        title: 'Billing months · Admin · IME',
        loadComponent: () =>
          import('./billing-month-page').then((m) => m.BillingMonthPage),
      },
      {
        path: 'claims/new',
        title: 'Copyright claim · Admin · IME',
        loadComponent: () =>
          import('./copyright-claim-page').then((m) => m.CopyrightClaimPage),
      },
    ],
  },
];
