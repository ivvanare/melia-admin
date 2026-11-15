import { Routes } from '@angular/router';
import { adminAccessGuard } from './core/admin-access.guard';
import { authGuard } from './core/auth.guard';

/**
 * One SPA, two surfaces (S2): a public front door at `/` with the sign-in, and
 * the panel under `/panel`, which needs a session *and* `admin.access`.
 *
 * Screens load lazily so the landing stays a small first paint. Everything under
 * `/panel` shares `PanelLayout` (sidebar built from `permissions` + outlet); the
 * "coming soon" modules that remain reuse one data-driven component instead of
 * several near-identical ones. Places already renders for real, over an
 * in-memory store, until `melia` ships its endpoints (place-ownership T1–T7).
 */
export const routes: Routes = [
  {
    path: '',
    title: 'melZone — places, menus and routes',
    loadComponent: () => import('./landing/landing').then((m) => m.Landing),
  },
  {
    path: 'login',
    title: 'Sign in — melZone panel',
    loadComponent: () => import('./auth/login').then((m) => m.Login),
  },
  {
    path: 'recuperar',
    title: 'Recover your password — melZone',
    loadComponent: () => import('./auth/recover').then((m) => m.Recover),
  },
  {
    path: 'registro',
    title: 'Create an account — melZone',
    loadComponent: () => import('./auth/signup').then((m) => m.Signup),
  },
  {
    // Authenticated but without `admin.access`: outside the panel chrome on
    // purpose, so the sidebar never appears for a session that cannot use it.
    path: 'no-access',
    title: 'No access — melZone panel',
    loadComponent: () => import('./access-denied/access-denied').then((m) => m.AccessDenied),
  },
  {
    path: 'panel',
    canActivate: [authGuard, adminAccessGuard],
    loadComponent: () => import('./panel/panel-layout').then((m) => m.PanelLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'Overview — melZone panel',
        loadComponent: () => import('./panel/overview/overview').then((m) => m.Overview),
      },
      {
        path: 'users',
        title: 'Users — melZone panel',
        loadComponent: () => import('./panel/users/users').then((m) => m.Users),
      },
      {
        path: 'roles',
        title: 'Roles and permissions — melZone panel',
        loadComponent: () => import('./panel/roles/roles').then((m) => m.Roles),
      },
      {
        path: 'plans',
        title: 'Plans — melZone panel',
        loadComponent: () => import('./panel/plans/plans').then((m) => m.Plans),
      },
      {
        path: 'invitations',
        title: 'Invitations — melZone panel',
        loadComponent: () => import('./panel/invitations/invitations').then((m) => m.Invitations),
      },
      {
        path: 'audit',
        title: 'Audit log — melZone panel',
        loadComponent: () => import('./panel/audit/audit').then((m) => m.Audit),
      },
      {
        path: 'account',
        title: 'My account — melZone panel',
        loadComponent: () => import('./account/account').then((m) => m.Account),
      },
      {
        path: 'places',
        title: 'Places — melZone panel',
        loadComponent: () => import('./panel/places/places').then((m) => m.Places),
      },
      {
        path: 'menus',
        pathMatch: 'full',
        redirectTo: 'places',
      },
      {
        path: 'reviews',
        title: 'Reviews — melZone panel',
        loadComponent: () => import('./panel/reviews/reviews').then((m) => m.Reviews),
      },
      {
        path: 'routes',
        pathMatch: 'full',
        redirectTo: 'plans',
      },
    ],
  },
  // The panel absorbed the old top-level URLs; keep them working as redirects.
  { path: 'account', pathMatch: 'full', redirectTo: 'panel/account' },
  { path: 'menus', pathMatch: 'full', redirectTo: 'panel/places' },
  { path: 'routes', pathMatch: 'full', redirectTo: 'panel/plans' },
  { path: '**', redirectTo: '' },
];
