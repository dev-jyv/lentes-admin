import { Routes } from '@angular/router';
import { adminGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login') },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/shell'),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
      { path: 'pedidos', loadComponent: () => import('./features/pedidos/pedidos') },
      { path: 'pedidos/:id', loadComponent: () => import('./features/pedidos/pedido') },
      { path: 'recetas', loadComponent: () => import('./features/recetas/recetas') },
      { path: 'inventario', loadComponent: () => import('./features/inventario/inventario') },
      { path: 'reportes', loadComponent: () => import('./features/reportes/reportes') },
      { path: 'productos/:productId/imagenes', loadComponent: () => import('./features/imagenes/imagenes') },
      { path: 'marcas', loadComponent: () => import('./features/marcas/marcas') },
      { path: 'home', loadComponent: () => import('./features/home/home') },
      { path: 'micas', loadComponent: () => import('./features/micas/micas') },
      { path: 'productos', loadComponent: () => import('./features/productos/productos') },
      { path: 'productos/:productId/variantes', loadComponent: () => import('./features/variantes/variantes') },
    ],
  },
  { path: '**', redirectTo: '' },
];
