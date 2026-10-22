import type { Route } from '@angular/router';
import { signedInGuard } from '@ime/client-data';

/**
 * Where artists' managers work, in its own frame beside the listening app.
 */
export const studioRoutes: Route[] = [
  {
    path: 'studio',
    canActivate: [signedInGuard],
    loadComponent: () => import('./studio-shell').then((m) => m.StudioShell),
    children: [
      {
        path: '',
        title: 'Studio · IME',
        loadComponent: () => import('./studio-home').then((m) => m.StudioHome),
      },
      {
        path: 'artists/new',
        title: 'New artist · Studio · IME',
        loadComponent: () =>
          import('./artists/create-artist-page').then(
            (m) => m.CreateArtistPage,
          ),
      },
      {
        path: 'artists/:artistId',
        loadComponent: () =>
          import('./artist-scope').then((m) => m.ArtistScope),
        children: [
          {
            path: '',
            title: 'Releases · Studio · IME',
            loadComponent: () =>
              import('./releases/releases-page').then((m) => m.ReleasesPage),
          },
          {
            path: 'profile',
            title: 'Profile · Studio · IME',
            loadComponent: () =>
              import('./artists/profile-page').then((m) => m.ProfilePage),
          },
          {
            path: 'managers',
            title: 'Managers · Studio · IME',
            loadComponent: () =>
              import('./artists/managers-page').then((m) => m.ManagersPage),
          },
          {
            path: 'merch',
            title: 'Merch · Studio · IME',
            loadComponent: () =>
              import('./merch/merch-page').then((m) => m.MerchPage),
          },
          {
            path: 'sales',
            title: 'Sales · Studio · IME',
            loadComponent: () =>
              import('./sales/sales-page').then((m) => m.SalesPage),
          },
          {
            path: 'sales/:artistOrderId',
            title: 'Sale · Studio · IME',
            loadComponent: () =>
              import('./sales/sale-page').then((m) => m.SalePage),
          },
          {
            path: 'payments',
            title: 'Getting paid · Studio · IME',
            loadComponent: () =>
              import('./payments/payments-page').then((m) => m.PaymentsPage),
          },
          {
            path: 'costs',
            title: 'Hosting costs · Studio · IME',
            loadComponent: () =>
              import('./billing/cost-split-page').then((m) => m.CostSplitPage),
          },
          {
            path: 'followers',
            title: 'Followers · Studio · IME',
            loadComponent: () =>
              import('./artists/followers-page').then((m) => m.FollowersPage),
          },
        ],
      },
      {
        path: 'products/:productId',
        title: 'Product · Studio · IME',
        loadComponent: () =>
          import('./merch/product-editor-page').then(
            (m) => m.ProductEditorPage,
          ),
      },
      {
        path: 'billing',
        title: 'Hosting balance · Studio · IME',
        loadComponent: () =>
          import('./billing/billing-page').then((m) => m.BillingPage),
      },
      {
        path: 'releases/:releaseId',
        title: 'Release · Studio · IME',
        loadComponent: () =>
          import('./releases/release-editor-page').then(
            (m) => m.ReleaseEditorPage,
          ),
      },
    ],
  },
];
