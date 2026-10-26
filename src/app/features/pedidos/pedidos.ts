import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { AdminOrderSummary, OrderStatus } from '../../api/provisional/model';
import { OrdersService } from '../../api/provisional/orders/orders.service';
import { formatDateTime } from '../../core/format';
import { formatMxn } from '../../core/money';
import { orderFolio, STATUS_LABEL } from '../../core/order-flow';
import { problemMessage } from '../../core/problem';

@Component({
  selector: 'app-pedidos',
  imports: [RouterLink],
  template: `
    <h1 class="mb-6 text-2xl font-semibold">Pedidos</h1>
    <div class="mb-4 flex items-center gap-2 text-sm">
      <label for="status">Estado</label>
      <select id="status" class="rounded border border-slate-300 px-3 py-2" (change)="filter($event)">
        <option value="">Todos</option>
        @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
      </select>
    </div>
    @if (error()) { <p role="alert" class="mb-4 text-sm text-red-700">{{ error() }}</p> }
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left"><th class="py-2">Folio</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Creado</th><th></th></tr></thead>
      <tbody>
        @for (o of orders(); track o.id) {
          <tr class="border-b">
            <td class="py-2 font-medium">{{ folio(o.number) }}</td>
            <td>{{ o.customer_email }}</td>
            <td>{{ label(o.status) }}</td>
            <td>{{ money(o.total_cents) }}</td>
            <td>{{ date(o.created_at) }}</td>
            <td class="text-right"><a class="underline" [routerLink]="['/pedidos', o.id]">Ver</a></td>
          </tr>
        } @empty {
          <tr><td colspan="6" class="py-4 text-slate-500">No hay pedidos con ese filtro.</td></tr>
        }
      </tbody>
    </table>
    @if (nextCursor()) {
      <button type="button" class="mt-4 rounded border border-slate-300 px-3 py-2 text-sm" (click)="load(true)">Cargar más</button>
    }
  `,
})
export default class Pedidos implements OnInit {
  private readonly api = inject(OrdersService);
  protected readonly orders = signal<AdminOrderSummary[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  private status: OrderStatus | undefined;

  protected readonly statuses = (Object.keys(STATUS_LABEL) as OrderStatus[]).map((value) => ({ value, label: STATUS_LABEL[value] }));
  protected folio = orderFolio;
  protected money = formatMxn;
  protected date = formatDateTime;
  protected label = (s: OrderStatus) => STATUS_LABEL[s];

  ngOnInit() {
    return this.load(false);
  }

  protected filter(event: Event) {
    this.status = ((event.target as HTMLSelectElement).value || undefined) as OrderStatus | undefined;
    return this.load(false);
  }

  protected async load(more: boolean) {
    try {
      const res = await firstValueFrom(
        this.api.adminListOrders({
          limit: 50,
          ...(this.status ? { status: this.status } : {}),
          ...(more && this.nextCursor() ? { cursor: this.nextCursor()! } : {}),
        }),
      );
      this.orders.update((list) => (more ? [...list, ...res.items] : res.items));
      this.nextCursor.set(res.next_cursor ?? null);
      this.error.set(null);
    } catch (e) {
      this.error.set(problemMessage(e, 'No se pudieron cargar los pedidos.'));
    }
  }
}
