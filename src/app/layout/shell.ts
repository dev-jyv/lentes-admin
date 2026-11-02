import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen">
      <aside class="w-56 shrink-0 border-r border-border bg-card p-4">
        <p class="mb-6 flex items-center gap-2">
          <svg viewBox="0 0 32 32" aria-hidden="true" class="size-7" fill="none">
            <circle cx="16" cy="16" r="14.2" stroke="var(--teal)" stroke-width="1.6" />
            <circle cx="16" cy="16" r="8.4" fill="var(--amber-soft)" stroke="var(--amber)" stroke-width="1.6" />
            <circle cx="16" cy="16" r="3.6" fill="var(--ink)" />
            <circle cx="14.4" cy="14.4" r="1.1" fill="#fff" opacity="0.9" />
          </svg>
          <span class="font-display text-xl font-extrabold tracking-tight">pupila</span>
          <span class="text-xs font-medium text-muted-foreground">admin</span>
        </p>
        <nav aria-label="Principal" class="flex flex-col gap-1 text-sm">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-accent font-semibold"
              class="rounded-full px-3 py-2 hover:bg-accent"
              >{{ item.label }}</a
            >
          }
        </nav>
      </aside>
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="flex items-center justify-end gap-3 border-b border-border px-6 py-3 text-sm">
          <span class="text-muted-foreground">{{ auth.email() }}</span>
          <button
            type="button"
            class="rounded-lg border border-input px-3 py-1 hover:bg-accent"
            [attr.aria-label]="dark() ? 'Activar modo claro' : 'Activar modo oscuro'"
            (click)="toggleTheme()"
          >
            {{ dark() ? 'Claro' : 'Oscuro' }}
          </button>
          <button type="button" class="rounded-lg border border-input px-3 py-1 hover:bg-accent" (click)="logout()">
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
    { path: '/inventario', label: 'Inventario' },
    { path: '/reportes', label: 'Reportes' },
    { path: '/marcas', label: 'Marcas' },
    { path: '/micas', label: 'Micas' },
    { path: '/home', label: 'Home' },
  ];

  protected readonly dark = signal(document.documentElement.dataset['theme'] === 'dark');

  protected toggleTheme() {
    const next = this.dark() ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = next;
    this.dark.set(next === 'dark');
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Sin almacenamiento (modo privado): el cambio vale solo para esta visita.
    }
  }

  protected async logout() {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
