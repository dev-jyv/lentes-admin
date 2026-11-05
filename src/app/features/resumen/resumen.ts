import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminOrderSummary, SalesReport } from '../../api/generated/model';
import { AttentionService } from '../../core/attention';
import { formatDate, formatDateTime } from '../../core/format';
import { t, TPipe } from '../../core/i18n';
import { formatMxn } from '../../core/money';
import { orderFolio } from '../../core/order-flow';
import { problemMessage } from '../../core/problem';
import { fillDays, lastDays } from '../../core/stats';
import { OrderStatusBadge } from '../../shared/order-status-badge';

const today = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' });

@Component({
  selector: 'app-resumen',
  imports: [RouterLink, TPipe, OrderStatusBadge],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">{{ 'resumen.title' | t }}</h1>
        <p class="mt-1 text-sm text-muted-foreground first-letter:uppercase">{{ todayLabel }}</p>
      </div>
      <a routerLink="/reportes" class="btn btn-secondary">{{ 'resumen.seeReports' | t }}</a>
    </header>

    @if (error()) { <p role="alert" class="alert-error mb-4">{{ error() }}</p> }

    <!-- Lo que el equipo vino a hacer: la cola de pendientes manda en la pantalla. -->
    <section aria-labelledby="todo" class="mb-8">
      <h2 id="todo" class="mb-3 text-lg">{{ 'resumen.todo' | t }}</h2>
      <ul class="grid overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(14_34_48/0.04)] grid-cols-3 divide-x divide-border">
        @for (q of queue(); track q.path) {
          <li>
            <a [routerLink]="q.path" [queryParams]="q.query" class="group flex h-full flex-col gap-1 p-3 sm:p-5 transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-inset">
              <span class="text-xs font-medium text-muted-foreground sm:text-sm">{{ q.label }}</span>
              @if (q.value === null && !failed()) {
                <span class="my-1 h-9 w-12 animate-pulse rounded-md bg-muted" aria-hidden="true"></span>
              } @else if (q.value === null) {
                <span class="text-3xl font-semibold text-muted-foreground sm:text-4xl">—</span>
              } @else if (q.count > 0) {
                <span class="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{{ q.value }}</span>
              } @else {
                <span class="flex items-center gap-1.5 py-1 text-base font-semibold text-good sm:gap-2 sm:text-xl">
                  <svg viewBox="0 0 24 24" class="size-5 sm:size-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  {{ 'resumen.allClear' | t }}
                </span>
              }
              <span class="hidden text-sm text-muted-foreground sm:block">{{ q.hint }}</span>
              <span class="mt-auto hidden items-center gap-1 pt-3 text-sm font-semibold text-primary sm:inline-flex">
                {{ 'resumen.open' | t }}
                <svg viewBox="0 0 24 24" class="size-4 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            </a>
          </li>
        }
      </ul>
    </section>

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="min-w-0 space-y-8">
        <section aria-labelledby="ventas">
          <h2 id="ventas" class="mb-3 text-lg">{{ 'resumen.sales7' | t }}</h2>
          <div class="rounded-2xl border border-border bg-card p-5">
            @if (sales(); as s) {
              <dl class="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <div>
                  <dt class="text-sm font-medium text-muted-foreground">{{ 'resumen.revenue' | t }}</dt>
                  <dd class="text-3xl font-semibold tracking-tight tabular-nums">{{ money(s.revenue_cents) }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-muted-foreground">{{ 'resumen.orders' | t }}</dt>
                  <dd class="text-xl font-semibold tabular-nums">{{ s.orders }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-muted-foreground">{{ 'resumen.units' | t }}</dt>
                  <dd class="text-xl font-semibold tabular-nums">{{ s.units }}</dd>
                </div>
              </dl>
              <!-- Una sola serie: el título la nombra; la tabla oculta da los valores a lectores de pantalla. -->
              <div class="mt-6 grid h-36 grid-cols-7 items-end gap-2 border-b border-border" aria-hidden="true">
                @for (d of days(); track d.date) {
                  <div class="group relative flex h-full flex-col justify-end">
                    <div class="mx-auto w-full max-w-10 min-h-0.5 rounded-t-[4px] bg-primary transition-opacity duration-150 group-hover:opacity-80" [style.height.%]="barHeight(d.revenue_cents)"></div>
                    <div class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-band px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block">
                      <span class="block font-semibold tabular-nums">{{ money(d.revenue_cents) }}</span>
                      <span class="text-white/75">{{ date(d.date) }} · {{ 'resumen.ordersCount' | t: { count: d.orders } }}</span>
                    </div>
                  </div>
                }
              </div>
              <div class="mt-2 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground" aria-hidden="true">
                @for (d of days(); track d.date) { <span>{{ day(d.date) }}</span> }
              </div>
              <table class="sr-only">
                <caption>{{ 'resumen.chartLabel' | t }}</caption>
                <tbody>
                  @for (d of days(); track d.date) { <tr><th scope="row">{{ date(d.date) }}</th><td>{{ money(d.revenue_cents) }}</td><td>{{ d.orders }}</td></tr> }
                </tbody>
              </table>
            } @else {
              <div class="h-56 animate-pulse rounded-lg bg-muted" aria-hidden="true"></div>
            }
          </div>
        </section>

        <section aria-labelledby="recientes">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 id="recientes" class="text-lg">{{ 'resumen.recent' | t }}</h2>
            <a routerLink="/pedidos" class="link text-sm">{{ 'resumen.seeAll' | t }}</a>
          </div>
          <ul class="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            @for (o of recent(); track o.id) {
              <li>
                <a [routerLink]="['/pedidos', o.id]" class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors duration-150 hover:bg-accent/50 focus-visible:ring-inset sm:grid-cols-[7rem_minmax(0,1fr)_8rem_7rem]">
                  <span class="optic text-sm font-medium">{{ folio(o.number) }}</span>
                  <span class="text-right text-sm font-semibold tabular-nums sm:order-last">{{ money(o.total_cents) }}</span>
                  <span class="min-w-0 truncate text-sm text-muted-foreground">{{ o.customer_email }} · {{ dateTime(o.created_at) }}</span>
                  <span class="justify-self-end sm:justify-self-start"><app-order-status-badge [status]="o.status" /></span>
                </a>
              </li>
            } @empty {
              @if (recentLoaded()) {
                <li class="px-5 py-6 text-sm text-muted-foreground">{{ 'resumen.noOrders' | t }}</li>
              } @else {
                @for (i of [1, 2, 3]; track i) { <li class="px-5 py-3"><div class="h-5 animate-pulse rounded bg-muted" aria-hidden="true"></div></li> }
              }
            }
          </ul>
        </section>
      </div>

      <section aria-labelledby="bajo" class="min-w-0">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 id="bajo" class="text-lg">{{ 'resumen.lowTitle' | t }}</h2>
          <a routerLink="/inventario" class="link text-sm">{{ 'resumen.seeInventory' | t }}</a>
        </div>
        <ul class="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          @for (i of low(); track i.variant_id) {
            <li class="flex items-center gap-3 px-5 py-3 text-sm">
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ i.product_name }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ i.brand_name }} · <span class="optic">{{ i.sku }}</span></p>
              </div>
              <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums" [class]="i.available <= 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-soft text-foreground'">
                {{ 'resumen.available' | t: { count: i.available } }}
              </span>
            </li>
          } @empty {
            @if (lowLoaded()) {
              <li class="px-5 py-6 text-sm text-muted-foreground">{{ 'resumen.noLow' | t }}</li>
            } @else {
              @for (i of [1, 2, 3]; track i) { <li class="px-5 py-3"><div class="h-5 animate-pulse rounded bg-muted" aria-hidden="true"></div></li> }
            }
          }
        </ul>
      </section>
    </div>
  `,
})
export default class Resumen implements OnInit {
  private readonly api = inject(DefaultService);
  private readonly attention = inject(AttentionService);
  private readonly range = lastDays(7);

  protected readonly todayLabel = today.format(new Date());
  protected readonly sales = signal<SalesReport | null>(null);
  protected readonly recent = signal<AdminOrderSummary[]>([]);
  protected readonly recentLoaded = signal(false);
  protected readonly failed = this.attention.failed;
  protected readonly lowLoaded = computed(() => this.attention.lowStock() !== null || this.failed());
  protected readonly error = signal<string | null>(null);

  protected readonly queue = computed(() => [
    { path: '/pedidos', query: { estado: 'paid' }, label: t('resumen.toShip'), hint: t('resumen.toShipHint'), value: this.attention.toShip(), count: this.attention.toShipCount() },
    { path: '/recetas', query: {}, label: t('resumen.rxPending'), hint: t('resumen.rxHint'), value: this.attention.rxPending(), count: this.attention.rxPendingCount() },
    {
      path: '/inventario',
      query: {},
      label: t('resumen.lowStock'),
      hint: t('resumen.lowHint'),
      value: this.attention.lowStock() === null ? null : String(this.attention.lowStock()!.length),
      count: this.attention.lowStock()?.length ?? 0,
    },
  ]);
  protected readonly days = computed(() => fillDays(this.sales()?.daily ?? [], this.range.from, this.range.to));
  protected readonly low = computed(() => [...(this.attention.lowStock() ?? [])].sort((a, b) => a.available - b.available).slice(0, 6));
  private readonly maxRevenue = computed(() => Math.max(0, ...this.days().map((d) => d.revenue_cents)));

  protected money = formatMxn;
  protected folio = orderFolio;
  protected date = formatDate;
  protected dateTime = formatDateTime;
  protected day = (iso: string) => weekday.format(new Date(`${iso}T00:00:00Z`)).replace('.', '');
  protected barHeight = (cents: number) => (this.maxRevenue() > 0 ? (cents / this.maxRevenue()) * 100 : 0);

  async ngOnInit() {
    const [sales, recent] = await Promise.allSettled([
      firstValueFrom(this.api.adminSalesReport(this.range)),
      firstValueFrom(this.api.adminListOrders({ limit: 6 })),
      this.attention.refresh(true),
    ]);
    if (sales.status === 'fulfilled') this.sales.set(sales.value);
    if (recent.status === 'fulfilled') this.recent.set(recent.value.items);
    this.recentLoaded.set(true);
    const failed = [sales, recent].find((r) => r.status === 'rejected');
    if (failed) this.error.set(problemMessage(failed.reason, t('resumen.loadFailed')));
    else if (this.attention.failed()) this.error.set(t('resumen.loadFailed'));
  }
}
