import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen">
      <aside class="w-56 shrink-0 border-r border-slate-200 bg-slate-50 p-4">
        <p class="mb-6 text-lg font-semibold">Lentes · Admin</p>
        <nav aria-label="Principal" class="flex flex-col gap-1 text-sm">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-slate-200 font-medium"
              class="rounded px-3 py-2 hover:bg-slate-100"
              >{{ item.label }}</a
            >
          }
        </nav>
      </aside>
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="flex items-center justify-end gap-3 border-b border-slate-200 px-6 py-3 text-sm">
          <span class="text-slate-600">{{ auth.email() }}</span>
          <button type="button" class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100" (click)="logout()">
            Cerrar sesión
          </button>
        </header>
        <main class="flex-1 p-6"><router-outlet /></main>
      </div>
    </div>
  `,
})
export default class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nav = [
    { path: '/pedidos', label: 'Pedidos' },
    { path: '/recetas', label: 'Recetas' },
    { path: '/productos', label: 'Productos' },
    { path: '/marcas', label: 'Marcas' },
  ];

  protected async logout() {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
