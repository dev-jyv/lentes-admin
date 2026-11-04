import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { t, TPipe } from '../core/i18n';

// Mismo lenguaje visual que la cabecera de lentes-web: franja oscura y una sola fila blanca con enlaces de texto.
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe],
  host: { '(document:keydown.escape)': 'closeMenu(true)' },
  template: `
    <div class="flex min-h-screen flex-col">
      <div class="bg-band text-white">
        <p class="container-page flex min-h-10 items-center justify-center py-1 text-sm font-medium">{{ 'shell.band' | t }}</p>
      </div>
      <header class="sticky top-0 z-40 border-b border-border bg-card">
        <div class="container-page flex h-16 items-center gap-3">
          <button
            #menuButton
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent lg:hidden"
            aria-controls="menu-principal"
            [attr.aria-expanded]="menuOpen()"
            [attr.aria-label]="menuOpen() ? ('shell.closeMenu' | t) : ('shell.openMenu' | t)"
            (click)="menuOpen.set(!menuOpen())"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="size-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              @if (menuOpen()) {
                <path d="M6 6l12 12M18 6L6 18" />
              } @else {
                <path d="M4 7h16M4 12h16M4 17h16" />
              }
            </svg>
          </button>
          <a routerLink="/" [attr.aria-label]="'shell.homeLabel' | t" class="flex min-h-11 shrink-0 items-center gap-2 rounded-full">
            <svg viewBox="0 0 32 32" aria-hidden="true" class="size-7" fill="none">
              <circle cx="16" cy="16" r="14.2" stroke="var(--teal)" stroke-width="1.6" />
              <circle cx="16" cy="16" r="8.4" fill="var(--amber-soft)" stroke="var(--amber)" stroke-width="1.6" />
              <circle cx="16" cy="16" r="3.6" fill="var(--ink)" />
              <circle cx="14.4" cy="14.4" r="1.1" fill="#fff" opacity="0.9" />
            </svg>
            <span class="font-display text-xl font-extrabold tracking-tight">{{ 'brand.wordmark' | t }}</span>
            <span class="text-xs font-medium text-muted-foreground">{{ 'shell.adminTag' | t }}</span>
          </a>
          <nav [attr.aria-label]="'shell.navLabel' | t" class="ml-2 hidden font-medium lg:block lg:text-sm xl:text-base">
            <ul class="flex items-center">
              @for (item of nav; track item.path) {
                <li>
                  <a
                    [routerLink]="item.path"
                    routerLinkActive
                    ariaCurrentWhenActive="page"
                    class="relative flex h-16 items-center px-2.5 whitespace-nowrap text-muted-foreground after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-foreground after:transition-transform hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:after:scale-x-100 xl:px-3 xl:after:inset-x-3"
                    >{{ item.label }}</a
                  >
                </li>
              }
            </ul>
          </nav>
          <div class="ml-auto flex min-w-0 items-center gap-1">
            <span class="hidden min-w-0 items-center gap-2 px-2 text-sm font-medium xl:flex">
              <svg viewBox="0 0 24 24" aria-hidden="true" class="size-6 shrink-0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              <span class="max-w-44 truncate" [title]="auth.email()">{{ auth.email() }}</span>
            </span>
            <button
              type="button"
              class="grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent"
              [attr.aria-label]="dark() ? ('shell.lightMode' | t) : ('shell.darkMode' | t)"
              (click)="toggleTheme()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" class="size-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                @if (dark()) {
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                } @else {
                  <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
                }
              </svg>
            </button>
            <button
              type="button"
              class="hidden min-h-11 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap hover:bg-accent sm:flex"
              (click)="logout()"
            >
              {{ 'common.signOut' | t }}
            </button>
          </div>
        </div>
        @if (menuOpen()) {
          <nav id="menu-principal" [attr.aria-label]="'shell.mobileNavLabel' | t" class="container-page max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border py-2 lg:hidden">
            <ul class="flex flex-col font-medium">
              @for (item of nav; track item.path) {
                <li>
                  <a
                    [routerLink]="item.path"
                    routerLinkActive
                    ariaCurrentWhenActive="page"
                    class="flex min-h-11 items-center rounded-full px-3 hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
                    (click)="closeMenu()"
                    >{{ item.label }}</a
                  >
                </li>
              }
            </ul>
            <div class="mt-2 border-t border-border pt-2 text-sm">
              <p class="truncate px-3 py-2 text-muted-foreground">{{ auth.email() }}</p>
              <button type="button" class="flex min-h-11 w-full items-center rounded-full px-3 font-medium hover:bg-accent" (click)="logout()">
                {{ 'common.signOut' | t }}
              </button>
            </div>
          </nav>
        }
      </header>
      <main class="container-page min-w-0 flex-1 py-6"><router-outlet /></main>
    </div>
  `,
})
export default class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  protected readonly nav = [
    { path: '/pedidos', label: t('nav.pedidos') },
    { path: '/recetas', label: t('nav.recetas') },
    { path: '/productos', label: t('nav.productos') },
    { path: '/inventario', label: t('nav.inventario') },
    { path: '/reportes', label: t('nav.reportes') },
    { path: '/marcas', label: t('nav.marcas') },
    { path: '/micas', label: t('nav.micas') },
    { path: '/home', label: t('nav.home') },
  ];

  protected readonly dark = signal(document.documentElement.dataset['theme'] === 'dark');
  protected readonly menuOpen = signal(false);

  protected closeMenu(returnFocus = false) {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    if (returnFocus) this.menuButton().nativeElement.focus();
  }

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
