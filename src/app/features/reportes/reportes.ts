import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { RepurchaseReport, SalesReport } from '../../api/generated/model';
import { DefaultService } from '../../api/generated/default/default.service';
import { formatDate } from '../../core/format';
import { formatMxn } from '../../core/money';
import { problemMessage } from '../../core/problem';
import { lastDays, pct } from '../../core/stats';
import { t, TPipe } from '../../core/i18n';

@Component({
  selector: 'app-reportes',
  imports: [TPipe],
  template: `
    <h1 class="page-title mb-6">{{ 'nav.reportes' | t }}</h1>
    <form class="panel mb-6 flex flex-wrap items-end gap-3 p-4" (submit)="apply($event)">
      <div><label for="from" class="field-label">{{ 'reportes.from' | t }}</label><input id="from" type="date" class="field" [value]="from()" (input)="from.set(val($event))" /></div>
      <div><label for="to" class="field-label">{{ 'reportes.to' | t }}</label><input id="to" type="date" class="field" [value]="to()" (input)="to.set(val($event))" /></div>
      <button type="submit" class="btn btn-primary">{{ 'reportes.query' | t }}</button>
      <div class="flex flex-wrap gap-2 sm:ml-auto">
        @for (d of presets; track d) {
          <button type="button" class="chip" [attr.aria-pressed]="days() === d" (click)="preset(d)">{{ 'reportes.days' | t: { days: d } }}</button>
        }
      </div>
    </form>
    @if (error()) { <p role="alert" class="alert-error mb-4">{{ error() }}</p> }

    @if (sales(); as s) {
      <section aria-labelledby="ventas" class="mb-10">
        <h2 id="ventas" class="mb-3 text-lg">{{ 'reportes.sales' | t }}</h2>
        <dl class="panel mb-6 grid grid-cols-3 divide-x divide-border">
          <div class="p-4 sm:p-5"><dt class="text-xs font-medium text-muted-foreground sm:text-sm">{{ 'reportes.revenue' | t }}</dt><dd class="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-3xl">{{ money(s.revenue_cents) }}</dd></div>
          <div class="p-4 sm:p-5"><dt class="text-xs font-medium text-muted-foreground sm:text-sm">{{ 'nav.pedidos' | t }}</dt><dd class="mt-1 text-xl font-semibold tabular-nums sm:text-3xl">{{ s.orders }}</dd></div>
          <div class="p-4 sm:p-5"><dt class="text-xs font-medium text-muted-foreground sm:text-sm">{{ 'reportes.unitsSold' | t }}</dt><dd class="mt-1 text-xl font-semibold tabular-nums sm:text-3xl">{{ s.units }}</dd></div>
        </dl>
        <div class="grid items-start gap-6 xl:grid-cols-2">
          <div class="panel overflow-x-auto">
            <table class="data-table">
              <caption>{{ 'reportes.byDay' | t }}</caption>
              <thead><tr><th scope="col">{{ 'common.date' | t }}</th><th scope="col" class="text-right">{{ 'nav.pedidos' | t }}</th><th scope="col" class="text-right">{{ 'reportes.revenue' | t }}</th><th scope="col" class="w-2/5"><span class="sr-only">{{ 'reportes.chart' | t }}</span></th></tr></thead>
              <tbody>
                @for (d of s.daily; track d.date) {
                  <tr>
                    <td class="whitespace-nowrap">{{ date(d.date) }}</td>
                    <td class="text-right tabular-nums">{{ d.orders }}</td>
                    <td class="text-right font-semibold whitespace-nowrap tabular-nums">{{ money(d.revenue_cents) }}</td>
                    <td><div class="h-3 min-w-0.5 rounded-r-[4px] bg-primary" [style.width.%]="barWidth(d.revenue_cents)" aria-hidden="true"></div></td>
                  </tr>
                } @empty { <tr><td colspan="4" class="empty">{{ 'reportes.noSales' | t }}</td></tr> }
              </tbody>
            </table>
          </div>
          <div class="panel overflow-x-auto">
            <table class="data-table">
              <caption>{{ 'reportes.topSold' | t }}</caption>
              <thead><tr><th scope="col">{{ 'common.product' | t }}</th><th scope="col" class="text-right">{{ 'reportes.boxes' | t }}</th><th scope="col" class="text-right">{{ 'reportes.revenue' | t }}</th></tr></thead>
              <tbody>
                @for (p of s.top_products; track p.product_name) {
                  <tr>
                    <td><span class="font-medium">{{ p.product_name }}</span><span class="ml-1 text-muted-foreground">· {{ p.brand_name }}</span></td>
                    <td class="text-right tabular-nums">{{ p.units }}</td>
                    <td class="text-right font-semibold whitespace-nowrap tabular-nums">{{ money(p.revenue_cents) }}</td>
                  </tr>
                } @empty { <tr><td colspan="3" class="empty">{{ 'reportes.noSales' | t }}</td></tr> }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    }

    @if (repurchase(); as r) {
      <section aria-labelledby="recompra">
        <h2 id="recompra" class="mb-3 text-lg">{{ 'reportes.repurchase' | t }}</h2>
        <dl class="panel grid divide-border sm:grid-cols-3 sm:divide-x max-sm:divide-y">
          <div class="p-5">
            <dt class="text-sm font-medium text-muted-foreground">{{ 'reportes.repeatCustomers' | t }}</dt>
            <dd class="mt-1 text-3xl font-semibold tabular-nums">{{ repeatRate() ?? '—' }}</dd>
            <dd class="mt-1 text-xs text-muted-foreground">{{ 'reportes.repeatOf' | t: { repeat: r.repeat_customers, total: r.customers } }}</dd>
          </div>
          <div class="p-5">
            <dt class="text-sm font-medium text-muted-foreground">{{ 'reportes.remindersSent' | t }}</dt>
            <dd class="mt-1 text-3xl font-semibold tabular-nums">{{ r.reminders_sent }}</dd>
          </div>
          <div class="p-5">
            <dt class="text-sm font-medium text-muted-foreground">{{ 'reportes.reminderConversion' | t }}</dt>
            <dd class="mt-1 text-3xl font-semibold tabular-nums">{{ reminderRate() ?? '—' }}</dd>
            <dd class="mt-1 text-xs text-muted-foreground">{{ 'reportes.reorders' | t: { count: r.reorders_from_reminder } }}</dd>
          </div>
        </dl>
      </section>
    }
  `,
})
export default class Reportes implements OnInit {
  private readonly api = inject(DefaultService);
  protected readonly from = signal(lastDays(30).from);
  protected readonly to = signal(lastDays(30).to);
  protected readonly sales = signal<SalesReport | null>(null);
  protected readonly repurchase = signal<RepurchaseReport | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly presets = [7, 30, 90];
  /** Atajo activo; null cuando el rango se escribió a mano. */
  protected readonly days = signal<number | null>(30);

  private readonly maxRevenue = computed(() => Math.max(0, ...(this.sales()?.daily.map((d) => d.revenue_cents) ?? [])));
  protected readonly repeatRate = computed(() => {
    const r = this.repurchase();
    return r ? pct(r.repeat_customers, r.customers) : null;
  });
  protected readonly reminderRate = computed(() => {
    const r = this.repurchase();
    return r ? pct(r.reorders_from_reminder, r.reminders_sent) : null;
  });

  protected money = formatMxn;
  protected date = formatDate;
  protected val = (e: Event) => (e.target as HTMLInputElement).value;
  protected barWidth = (cents: number) => (this.maxRevenue() > 0 ? (cents / this.maxRevenue()) * 100 : 0);

  ngOnInit() {
    return this.load();
  }

  protected apply(event: Event) {
    event.preventDefault();
    this.days.set(null);
    return this.load();
  }

  protected preset(days: number) {
    const r = lastDays(days);
    this.days.set(days);
    this.from.set(r.from);
    this.to.set(r.to);
    return this.load();
  }

  private async load() {
    if (!this.from() || !this.to() || this.from() > this.to()) {
      return this.error.set(t('reportes.badRange'));
    }
    this.error.set(null);
    const range = { from: this.from(), to: this.to() };
    try {
      const [sales, repurchase] = await Promise.all([
        firstValueFrom(this.api.adminSalesReport(range)),
        firstValueFrom(this.api.adminRepurchaseReport(range)),
      ]);
      this.sales.set(sales);
      this.repurchase.set(repurchase);
    } catch (e) {
      this.error.set(problemMessage(e, t('reportes.loadFailed')));
    }
  }
}
