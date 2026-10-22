import { Route } from '@angular/router';
import { signedInGuard, signedOutGuard } from '@ime/client-data';
import { listeningRoutes } from '@ime/client-listening';
import { AppShell } from './shell/app-shell';
import { adminRoutes } from './admin/admin.routes';
import { studioRoutes } from './studio/studio.routes';

export const appRoutes: Route[] = [
  ...studioRoutes,
  ...adminRoutes,
  {
    path: '',
    component: AppShell,
    children: [
      ...listeningRoutes,
      {
        path: 'sign-in',
        title: 'Sign in · IME',
        canActivate: [signedOutGuard],
        loadComponent: () =>
          import('./accounts/sign-in-page').then((m) => m.SignInPage),
      },
      {
        path: 'sign-up',
        title: 'Create your account · IME',
        canActivate: [signedOutGuard],
        loadComponent: () =>
          import('./accounts/sign-up-page').then((m) => m.SignUpPage),
      },
      {
        path: 'forgot-password',
        title: 'Reset your password · IME',
        loadComponent: () =>
          import('./accounts/forgot-password-page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      {
        path: 'reset-password',
        title: 'Choose a new password · IME',
        loadComponent: () =>
          import('./accounts/reset-password-page').then(
            (m) => m.ResetPasswordPage,
          ),
      },
      {
        path: 'account',
        title: 'Account settings · IME',
        canActivate: [signedInGuard],
        loadComponent: () =>
          import('./accounts/account-page').then((m) => m.AccountPage),
      },
      {
        path: 'users/:username',
        title: 'Profile · IME',
        loadComponent: () =>
          import('./accounts/user-profile-page').then((m) => m.UserProfilePage),
      },
      {
        path: 'terms',
        title: 'Terms of service · IME',
        data: { heading: 'Terms of service' },
        loadComponent: () =>
          import('./pages/legal-page').then((m) => m.LegalPage),
      },
      {
        path: 'privacy',
        title: 'Privacy policy · IME',
        data: { heading: 'Privacy policy' },
        loadComponent: () =>
          import('./pages/legal-page').then((m) => m.LegalPage),
      },
      {
        path: 'artist-pages/releases/:releaseId',
        title: 'Artist page · IME',
        loadComponent: () =>
          import('./artist-page/artist-page.component').then(
            (m) => m.ArtistPage,
          ),
      },
      {
        path: '**',
        title: 'Not found · IME',
        loadComponent: () =>
          import('./pages/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
