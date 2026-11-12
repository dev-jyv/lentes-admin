import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AttentionService } from '../core/attention';
import { AuthService } from '../core/auth.service';
import { t, TPipe } from '../core/i18n';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: () => string | null;
  badgeText?: (count: string) => string;
}

// Íconos de trazo 1.6 en una retícula de 24; todos del mismo dibujo para que el menú se lea como un solo sistema.
const ICON = {
  resumen: 'M4 4h6v8H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 16h6v4H4z',
  pedidos: 'M5 8h14l-1.2 12H6.2zM9 8V6.5a3 3 0 0 1 6 0V8',
  recetas: 'M7 3h7l4 4v14H7zM14 3v4h4M10 14.5l1.8 1.8 3.2-3.8',
  productos: 'M3.5 12.5V4h8.5l8.5 8.5-8 8zM8 8.5h.01',
  marcas: 'M12 3.5l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z',
  catalogos: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  micas: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  inventario: 'M12 3.5l8.5 4.5-8.5 4.5L3.5 8zM3.5 12.5l8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5',
  home: 'M4 10 5.5 4h13L20 10M4 10v10h16V10M4 10h16M10 20v-5h4v5',
  reportes: 'M3 20h18M6 16.5v-5M11 16.5V6M16 16.5v-8',
  more: 'M4 7h16M4 12h16M4 17h16',
};

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, TPipe],
  host: { '(document:keydown.escape)': 'closeMore(true)' },
  styles: `
    .safe-bottom {
      padding-bottom: env(safe-area-inset-bottom);
    }
  `,
  template: `
    <ng-template #icon let-d>
      <svg viewBox="0 0 24 24" aria-hidden="true" class="size-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path [attr.d]="d" />
      </svg>
    </ng-template>

    <div class="min-h-screen lg:pl-64">
      <!-- Barra lateral (escritorio): clara como la de lentes-web (--sidebar = superficie), con borde fino. -->
      <aside class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <a routerLink="/" [attr.aria-label]="'shell.homeLabel' | t" class="mx-3 mt-4 mb-2 flex min-h-12 items-center gap-2.5 rounded-xl px-3">
          <ng-container [ngTemplateOutlet]="logo" />
          <span class="font-display text-xl font-extrabold tracking-tight">{{ 'brand.wordmark' | t }}</span>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{{ 'shell.adminTag' | t }}</span>
        </a>
        <nav [attr.aria-label]="'shell.navLabel' | t" class="flex-1 overflow-y-auto px-3 pb-4">
          @for (group of groups; track group.label) {
            @if (group.label) {
              <p class="mt-5 mb-1 px-3 text-xs font-semibold text-muted-foreground" [id]="'grp-' + $index">{{ group.label }}</p>
            }
            <ul class="space-y-0.5" [attr.aria-labelledby]="group.label ? 'grp-' + $index : null">
              @for (item of group.items; track item.path) {
                <li>
                  <a
                    [routerLink]="item.path"
                    routerLinkActive
                    [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                    ariaCurrentWhenActive="page"
                    class="group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-accent-foreground"
                  >
                    <span class="group-hover:text-foreground group-aria-[current=page]:text-sidebar-primary">
                      <ng-container [ngTemplateOutlet]="icon" [ngTemplateOutletContext]="{ $implicit: item.icon }" />
                    </span>
                    <span class="flex-1">{{ item.label }}</span>
                    @if (badgeOf(item); as b) {
                      <span class="min-w-6 rounded-full bg-amber-soft px-1.5 py-0.5 text-center text-xs font-semibold text-foreground tabular-nums" aria-hidden="true">{{ b }}</span>
                      <span class="sr-only">, {{ item.badgeText!(b) }}</span>
                    }
                  </a>
                </li>
              }
            </ul>
          }
        </nav>
        <div class="border-t border-sidebar-border p-3">
          <p class="truncate px-3 pb-2 text-xs text-muted-foreground" [title]="auth.email()">{{ auth.email() }}</p>
          <div class="flex items-center gap-1">
            <button type="button" class="flex min-h-10 flex-1 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" (click)="logout()">
              {{ 'common.signOut' | t }}
            </button>
            <ng-container [ngTemplateOutlet]="themeButton" [ngTemplateOutletContext]="{ $implicit: 'text-muted-foreground hover:bg-muted hover:text-foreground' }" />
          </div>
        </div>
      </aside>

      <!-- Cabecera (teléfono y tableta). -->
      <header class="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm lg:hidden">
        <div class="container-page flex h-14 items-center gap-2">
          <a routerLink="/" [attr.aria-label]="'shell.homeLabel' | t" class="flex min-h-11 items-center gap-2 rounded-full">
            <ng-container [ngTemplateOutlet]="logo" />
            <span class="font-display text-lg font-extrabold tracking-tight">{{ 'brand.wordmark' | t }}</span>
            <span class="text-xs font-medium text-muted-foreground">{{ 'shell.adminTag' | t }}</span>
          </a>
          <div class="ml-auto">
            <ng-container [ngTemplateOutlet]="themeButton" [ngTemplateOutletContext]="{ $implicit: 'hover:bg-accent' }" />
          </div>
        </div>
      </header>

      <main class="container-page min-w-0 py-6 pb-28 lg:py-8 lg:pb-10"><router-outlet /></main>

      <!-- Hoja "Más" (teléfono): el resto de secciones y cerrar sesión. -->
      @if (moreOpen()) {
        <div class="fixed inset-0 z-40 bg-band/40 lg:hidden" aria-hidden="true" (click)="closeMore()"></div>
        <nav id="menu-mas" [attr.aria-label]="'shell.moreLabel' | t" class="safe-bottom fixed inset-x-0 bottom-16 z-50 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pt-3 pb-4 shadow-[0_-8px_24px_rgb(14_34_48/0.12)] lg:hidden">
          @for (group of groups; track group.label) {
            @if (group.label) {
              <p class="mt-3 mb-1 px-3 text-xs font-semibold text-muted-foreground">{{ group.label }}</p>
            }
            <ul>
              @for (item of group.items; track item.path) {
                <li>
                  <a
                    [routerLink]="item.path"
                    routerLinkActive
                    [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                    ariaCurrentWhenActive="page"
                    class="flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:text-primary"
                    (click)="closeMore()"
                  >
                    <ng-container [ngTemplateOutlet]="icon" [ngTemplateOutletContext]="{ $implicit: item.icon }" />
                    <span class="flex-1">{{ item.label }}</span>
                    @if (badgeOf(item); as b) {
                      <span class="min-w-6 rounded-full bg-amber-soft px-1.5 py-0.5 text-center text-xs font-semibold text-foreground tabular-nums" aria-hidden="true">{{ b }}</span>
                      <span class="sr-only">, {{ item.badgeText!(b) }}</span>
                    }
                  </a>
                </li>
              }
            </ul>
          }
          <div class="mt-3 border-t border-border pt-3 text-sm">
            <p class="truncate px-3 pb-1 text-muted-foreground">{{ auth.email() }}</p>
            <button type="button" class="flex min-h-11 w-full items-center rounded-lg px-3 font-medium hover:bg-accent" (click)="logout()">{{ 'common.signOut' | t }}</button>
          </div>
        </nav>
      }

      <!-- Pestañas inferiores (teléfono): las tareas más frecuentes a un toque. -->
      <nav [attr.aria-label]="'shell.tabsLabel' | t" class="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card lg:hidden">
        <ul class="mx-auto grid h-16 max-w-xl grid-cols-5">
          @for (item of tabs; track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                ariaCurrentWhenActive="page"
                class="relative flex h-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground aria-[current=page]:text-primary"
                (click)="closeMore()"
              >
                <span class="relative">
                  <ng-container [ngTemplateOutlet]="icon" [ngTemplateOutletContext]="{ $implicit: item.icon }" />
                  @if (badgeOf(item); as b) {
                    <span class="absolute -top-1.5 left-3 min-w-4.5 rounded-full bg-amber px-1 text-center text-[0.6875rem] leading-4.5 font-semibold text-band tabular-nums" aria-hidden="true">{{ b }}</span>
                  }
                </span>
                {{ item.label }}
                @if (badgeOf(item); as b) { <span class="sr-only">, {{ item.badgeText!(b) }}</span> }
              </a>
            </li>
          }
          <li>
            <button
              #moreButton
              type="button"
              class="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground aria-expanded:text-primary"
              aria-controls="menu-mas"
              [attr.aria-expanded]="moreOpen()"
              (click)="moreOpen.set(!moreOpen())"
            >
              <ng-container [ngTemplateOutlet]="icon" [ngTemplateOutletContext]="{ $implicit: icons.more }" />
              {{ 'nav.more' | t }}
            </button>
          </li>
        </ul>
      </nav>
    </div>

    <ng-template #logo>
      <svg viewBox="0 0 32 32" aria-hidden="true" class="size-7 shrink-0" fill="none">
        <circle cx="16" cy="16" r="14.2" stroke="var(--teal)" stroke-width="1.6" />
        <circle cx="16" cy="16" r="8.4" fill="var(--amber-soft)" stroke="var(--amber)" stroke-width="1.6" />
        <circle cx="16" cy="16" r="3.6" fill="var(--ink)" />
        <circle cx="14.4" cy="14.4" r="1.1" fill="#fff" opacity="0.9" />
      </svg>
    </ng-template>

    <ng-template #themeButton let-extra>
      <button
        type="button"
        class="grid size-10 shrink-0 place-items-center rounded-lg {{ extra }}"
        [attr.aria-label]="dark() ? ('shell.lightMode' | t) : ('shell.darkMode' | t)"
        (click)="toggleTheme()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="size-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          @if (dark()) {
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          } @else {
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
          }
        </svg>
      </button>
    </ng-template>
  `,
})
export default class Shell {
  protected readonly auth = inject(AuthService);
  private readonly attention = inject(AttentionService);
  private readonly router = inject(Router);
  private readonly moreButton = viewChild.required<ElementRef<HTMLButtonElement>>('moreButton');
  protected readonly icons = ICON;

  private readonly items: Record<string, NavItem> = {
    resumen: { path: '/', label: t('nav.resumen'), icon: ICON.resumen },
    pedidos: {
      path: '/pedidos',
      label: t('nav.pedidos'),
      icon: ICON.pedidos,
      badge: () => (this.attention.toShipCount() > 0 ? this.attention.toShip() : null),
      badgeText: (count) => t('shell.badgeToShip', { count }),
    },
    recetas: {
      path: '/recetas',
      label: t('nav.recetas'),
      icon: ICON.recetas,
      badge: () => (this.attention.rxPendingCount() > 0 ? this.attention.rxPending() : null),
      badgeText: (count) => t('shell.badgeRx', { count }),
    },
    productos: { path: '/productos', label: t('nav.productos'), icon: ICON.productos },
    marcas: { path: '/marcas', label: t('nav.marcas'), icon: ICON.marcas },
    catalogos: { path: '/catalogos', label: t('nav.catalogos'), icon: ICON.catalogos },
    micas: { path: '/micas', label: t('nav.micas'), icon: ICON.micas },
    inventario: {
      path: '/inventario',
      label: t('nav.inventario'),
      icon: ICON.inventario,
      badge: () => (this.attention.lowStock()?.length ? String(this.attention.lowStock()!.length) : null),
      badgeText: (count) => t('shell.badgeLow', { count }),
    },
    home: { path: '/home', label: t('nav.home'), icon: ICON.home },
    reportes: { path: '/reportes', label: t('nav.reportes'), icon: ICON.reportes },
  };

  protected readonly groups = [
    { label: '', items: [this.items['resumen']] },
    { label: t('navGroups.sales'), items: [this.items['pedidos'], this.items['recetas']] },
    { label: t('navGroups.catalog'), items: [this.items['productos'], this.items['marcas'], this.items['catalogos'], this.items['micas'], this.items['inventario']] },
    { label: t('navGroups.store'), items: [this.items['home']] },
    { label: t('navGroups.insights'), items: [this.items['reportes']] },
  ];
  protected readonly tabs = [this.items['resumen'], this.items['pedidos'], this.items['recetas'], this.items['productos']];

  protected readonly dark = signal(document.documentElement.dataset['theme'] === 'dark');
  protected readonly moreOpen = signal(false);
  protected readonly badgeOf = (item: NavItem) => item.badge?.() ?? null;

  constructor() {
    const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => void this.attention.refresh());
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    void this.attention.refresh();
  }

  protected closeMore(returnFocus = false) {
    if (!this.moreOpen()) return;
    this.moreOpen.set(false);
    if (returnFocus) this.moreButton().nativeElement.focus();
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
