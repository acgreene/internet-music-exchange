import type { Route } from '@angular/router';
import { signedInGuard } from '@ime/client-data';

/**
 * Dig mode, a focused space of its own outside the app's frame.
 */
export const digRoutes: Route[] = [
  {
    path: 'dig/crates/:crateId',
    title: 'Dig | IME',
    loadComponent: () => import('./dig/dig-page').then((m) => m.DigPage),
  },
  {
    path: 'dig/sound',
    title: 'Dig | IME',
    loadComponent: () => import('./dig/dig-page').then((m) => m.DigPage),
  },
];

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
    title: 'Search | IME',
    loadComponent: () =>
      import('./search/search-page').then((m) => m.SearchPage),
  },
  {
    path: 'charts',
    title: 'Charts | IME',
    loadComponent: () =>
      import('./charts/charts-page').then((m) => m.ChartsPage),
  },
  {
    path: 'crates',
    title: 'Crates | IME',
    loadComponent: () =>
      import('./crates/crates-page').then((m) => m.CratesPage),
  },
  {
    path: 'crates/sound',
    title: 'A crate by sound | IME',
    data: { kind: 'sound' },
    loadComponent: () =>
      import('./crates/built-crate-page').then((m) => m.BuiltCratePage),
  },
  {
    path: 'crates/genre/:genre',
    title: 'Crates by genre | IME',
    loadComponent: () =>
      import('./crates/genre-crates-page').then((m) => m.GenreCratesPage),
  },
  {
    path: 'crates/day',
    title: 'Your crate of the day | IME',
    data: { kind: 'day' },
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./crates/built-crate-page').then((m) => m.BuiltCratePage),
  },
  {
    path: 'crates/build',
    title: 'Build a crate | IME',
    data: { kind: 'records' },
    loadComponent: () =>
      import('./crates/built-crate-page').then((m) => m.BuiltCratePage),
  },
  {
    path: 'crates/:crateId',
    title: 'Crate | IME',
    loadComponent: () => import('./crates/crate-page').then((m) => m.CratePage),
  },
  {
    path: 'designs',
    title: 'Design gallery | IME',
    loadComponent: () =>
      import('./designs/gallery-page').then((m) => m.GalleryPage),
  },
  {
    path: 'designs/designers',
    title: 'Designers | IME',
    loadComponent: () =>
      import('./designs/designers-page').then((m) => m.DesignersPage),
  },
  {
    path: 'designs/:designId',
    title: 'Design | IME',
    loadComponent: () =>
      import('./designs/design-page').then((m) => m.DesignPage),
  },
  {
    path: 'following',
    title: 'Following | IME',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./follow/following-page').then((m) => m.FollowingPage),
  },
  {
    path: 'artists/:handle',
    title: 'Artist | IME',
    loadComponent: () =>
      import('./artists/artist-page').then((m) => m.ArtistPage),
  },
  {
    path: 'artists/:handle/:slug',
    title: 'Release | IME',
    loadComponent: () =>
      import('./releases/release-page').then((m) => m.ReleasePage),
  },
  {
    path: 'artists/:handle/merch/:productId',
    title: 'Merch | IME',
    loadComponent: () =>
      import('./merch/product-page').then((m) => m.ProductPage),
  },
  {
    path: 'cart',
    title: 'Cart | IME',
    loadComponent: () => import('./buying/cart-page').then((m) => m.CartPage),
  },
  {
    path: 'checkout/:orderId',
    title: 'Checkout | IME',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./buying/checkout-page').then((m) => m.CheckoutPage),
  },
  {
    path: 'library',
    title: 'Library | IME',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./buying/library-page').then((m) => m.LibraryPage),
  },
  {
    path: 'purchases',
    title: 'Purchases | IME',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./buying/purchases-page').then((m) => m.PurchasesPage),
  },
  {
    path: 'purchases/:artistOrderId',
    title: 'Purchase | IME',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./buying/purchase-page').then((m) => m.PurchasePage),
  },
];
