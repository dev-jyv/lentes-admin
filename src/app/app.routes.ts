import { Routes } from '@angular/router';
import { adminGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login') },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/shell'),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'productos' },
      { path: 'marcas', loadComponent: () => import('./features/marcas/marcas') },
      { path: 'productos', loadComponent: () => import('./features/productos/productos') },
      { path: 'productos/:productId/variantes', loadComponent: () => import('./features/variantes/variantes') },
    ],
  },
  { path: '**', redirectTo: '' },
];
