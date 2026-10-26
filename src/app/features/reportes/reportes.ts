import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { RepurchaseReport, SalesReport } from '../../api/provisional/model';
import { ReportsService } from '../../api/provisional/reports/reports.service';
import { formatDate } from '../../core/format';
import { formatMxn } from '../../core/money';
import { problemMessage } from '../../core/problem';
import { lastDays, pct } from '../../core/stats';

@Component({
  selector: 'app-reportes',
  template: `
    <h1 class="mb-6 text-2xl">Reportes</h1>
    <form class="mb-6 flex flex-wrap items-end gap-3 text-sm" (submit)="apply($event)">
      <div><label for="from" class="mb-1 block">Desde</label><input id="from" type="date" class="rounded-lg border border-input px-3 py-2" [value]="from()" (input)="from.set(val($event))" /></div>
      <div><label for="to" class="mb-1 block">Hasta</label><input id="to" type="date" class="rounded-lg border border-input px-3 py-2" [value]="to()" (input)="to.set(val($event))" /></div>
      <button type="submit" class="rounded-lg bg-primary px-3 py-2 text-primary-foreground">Consultar</button>
      <button type="button" class="rounded-lg border border-input px-3 py-2" (click)="preset(7)">7 días</button>
      <button type="button" class="rounded-lg border border-input px-3 py-2" (click)="preset(30)">30 días</button>
      <button type="button" class="rounded-lg border border-input px-3 py-2" (click)="preset(90)">90 días</button>
    </form>
    @if (error()) { <p role="alert" class="mb-4 text-sm text-destructive">{{ error() }}</p> }

    @if (sales(); as s) {
      <section aria-labelledby="ventas" class="mb-8">
        <h2 id="ventas" class="mb-3 font-medium">Ventas</h2>
        <dl class="mb-4 grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-border p-4"><dt class="text-sm text-muted-foreground">Pedidos</dt><dd class="text-2xl">{{ s.orders }}</dd></div>
          <div class="rounded-lg border border-border p-4"><dt class="text-sm text-muted-foreground">Ingresos</dt><dd class="text-2xl">{{ money(s.revenue_cents) }}</dd></div>
          <div class="rounded-lg border border-border p-4"><dt class="text-sm text-muted-foreground">Cajas vendidas</dt><dd class="text-2xl">{{ s.units }}</dd></div>
        </dl>
        <table class="mb-6 w-full text-sm">
          <caption class="mb-2 text-left font-medium">Por día</caption>
          <thead><tr class="border-b text-left"><th class="py-1">Fecha</th><th>Pedidos</th><th>Ingresos</th><th class="w-1/2"><span class="sr-only">Gráfica</span></th></tr></thead>
          <tbody>
            @for (d of s.daily; track d.date) {
              <tr class="border-b">
                <td class="py-1">{{ date(d.date) }}</td><td>{{ d.orders }}</td><td>{{ money(d.revenue_cents) }}</td>
                <td><div class="h-3 rounded-lg bg-primary" [style.width.%]="barWidth(d.revenue_cents)" aria-hidden="true"></div></td>
              </tr>
            }
          </tbody>
        </table>
        <table class="w-full max-w-2xl text-sm">
          <caption class="mb-2 text-left font-medium">Más vendidos</caption>
          <thead><tr class="border-b text-left"><th class="py-1">Producto</th><th>Cajas</th><th class="text-right">Ingresos</th></tr></thead>
          <tbody>
            @for (p of s.top_products; track p.product_name) {
              <tr class="border-b"><td class="py-1">{{ p.product_name }} <span class="text-muted-foreground">· {{ p.brand_name }}</span></td><td>{{ p.units }}</td><td class="text-right">{{ money(p.revenue_cents) }}</td></tr>
            } @empty { <tr><td colspan="3" class="py-2 text-muted-foreground">Sin ventas en el rango.</td></tr> }
          </tbody>
        </table>
      </section>
    }

    @if (repurchase(); as r) {
      <section aria-labelledby="recompra">
        <h2 id="recompra" class="mb-3 font-medium">Recompra</h2>
        <dl class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-border p-4">
            <dt class="text-sm text-muted-foreground">Clientes que repiten</dt>
            <dd class="text-2xl">{{ repeatRate() ?? '—' }}</dd>
            <dd class="text-xs text-muted-foreground">{{ r.repeat_customers }} de {{ r.customers }} clientes</dd>
          </div>
          <div class="rounded-lg border border-border p-4">
            <dt class="text-sm text-muted-foreground">Recordatorios enviados</dt>
            <dd class="text-2xl">{{ r.reminders_sent }}</dd>
          </div>
          <div class="rounded-lg border border-border p-4">
            <dt class="text-sm text-muted-foreground">Conversión del recordatorio</dt>
            <dd class="text-2xl">{{ reminderRate() ?? '—' }}</dd>
            <dd class="text-xs text-muted-foreground">{{ r.reorders_from_reminder }} pedidos</dd>
          </div>
        </dl>
      </section>
    }
  `,
})
export default class Reportes implements OnInit {
  private readonly api = inject(ReportsService);
  protected readonly from = signal(lastDays(30).from);
  protected readonly to = signal(lastDays(30).to);
  protected readonly sales = signal<SalesReport | null>(null);
  protected readonly repurchase = signal<RepurchaseReport | null>(null);
  protected readonly error = signal<string | null>(null);

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
    return this.load();
  }

  protected preset(days: number) {
    const r = lastDays(days);
    this.from.set(r.from);
    this.to.set(r.to);
    return this.load();
  }

  private async load() {
    if (!this.from() || !this.to() || this.from() > this.to()) {
      return this.error.set('Revisa el rango de fechas: "Desde" debe ser anterior o igual a "Hasta".');
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
      this.error.set(problemMessage(e, 'No se pudieron cargar los reportes.'));
    }
  }
}
