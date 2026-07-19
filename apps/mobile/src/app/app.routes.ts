import { Route } from '@angular/router';
import { HomePage } from './home/home-page';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: HomePage,
    title: 'Internet Music Exchange',
  },
  {
    path: 'sign-in',
    loadComponent: () => import('@ime/feature-auth').then((m) => m.SignInPage),
    title: 'Sign in — Internet Music Exchange',
  },
  {
    path: 'sign-up',
    loadComponent: () => import('@ime/feature-auth').then((m) => m.SignUpPage),
    title: 'Create account — Internet Music Exchange',
  },
];
