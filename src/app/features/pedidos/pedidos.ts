import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminOrderSummary, OrderStatus } from '../../api/generated/model';
import { formatDateTime } from '../../core/format';
import { formatMxn } from '../../core/money';
import { orderFolio, STATUS_LABEL } from '../../core/order-flow';
import { problemMessage } from '../../core/problem';
import { t, TPipe } from '../../core/i18n';
import { OrderStatusBadge } from '../../shared/order-status-badge';

@Component({
  selector: 'app-pedidos',
  imports: [RouterLink, TPipe, OrderStatusBadge],
  template: `
    <h1 class="page-title mb-5">{{ 'nav.pedidos' | t }}</h1>

    <!-- Filtro por estado como chips: se recorre con el pulgar en el teléfono. -->
    <div role="group" [attr.aria-label]="'pedidos.filterLabel' | t" class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      @for (s of filters; track s.value) {
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="status() === s.value"
          (click)="filter(s.value)"
        >
          {{ s.label }}
        </button>
      }
    </div>

    @if (error()) { <p role="alert" class="alert-error mb-4">{{ error() }}</p> }

    <div class="panel overflow-hidden">
      <!-- Escritorio: tabla. -->
      <table class="hidden w-full text-sm md:table" [attr.aria-busy]="loading()">
        <thead class="bg-muted/60 text-left text-xs font-semibold text-muted-foreground">
          <tr>
            <th scope="col" class="px-5 py-3">{{ 'pedidos.folio' | t }}</th>
            <th scope="col" class="px-3 py-3">{{ 'pedidos.customer' | t }}</th>
            <th scope="col" class="px-3 py-3">{{ 'common.status' | t }}</th>
            <th scope="col" class="px-3 py-3 text-right">{{ 'common.total' | t }}</th>
            <th scope="col" class="px-3 py-3">{{ 'pedidos.created' | t }}</th>
            <th scope="col" class="px-5 py-3"><span class="sr-only">{{ 'common.view' | t }}</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          @for (o of orders(); track o.id) {
            <tr class="transition-colors duration-150 hover:bg-accent/40">
              <td class="optic px-5 py-3 font-medium">{{ folio(o.number) }}</td>
              <td class="max-w-64 truncate px-3 py-3">{{ o.customer_email }}</td>
              <td class="px-3 py-3"><app-order-status-badge [status]="o.status" /></td>
              <td class="px-3 py-3 text-right font-semibold tabular-nums">{{ money(o.total_cents) }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-muted-foreground">{{ date(o.created_at) }}</td>
              <td class="px-5 py-3 text-right">
                <a class="link" [routerLink]="['/pedidos', o.id]">{{ 'common.view' | t }}<span class="sr-only"> {{ folio(o.number) }}</span></a>
              </td>
            </tr>
          } @empty {
            @if (loading()) {
              @for (i of skeleton; track i) { <tr><td colspan="6" class="px-5 py-3"><div class="h-5 animate-pulse rounded bg-muted" aria-hidden="true"></div></td></tr> }
            } @else {
              <tr><td colspan="6" class="px-5 py-8 text-center text-muted-foreground">{{ 'pedidos.empty' | t }}</td></tr>
            }
          }
        </tbody>
      </table>

      <!-- Teléfono: cada pedido es una fila tocable completa. -->
      <ul class="divide-y divide-border md:hidden" [attr.aria-busy]="loading()">
        @for (o of orders(); track o.id) {
          <li>
            <a [routerLink]="['/pedidos', o.id]" class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-4 py-3.5 active:bg-accent/50 focus-visible:ring-inset">
              <span class="optic text-sm font-medium">{{ folio(o.number) }}</span>
              <span class="text-right text-sm font-semibold tabular-nums">{{ money(o.total_cents) }}</span>
              <span class="min-w-0 truncate text-sm text-muted-foreground">{{ o.customer_email }}</span>
              <span class="justify-self-end"><app-order-status-badge [status]="o.status" /></span>
              <span class="col-span-2 text-xs text-muted-foreground">{{ date(o.created_at) }}</span>
            </a>
          </li>
        } @empty {
          @if (loading()) {
            @for (i of skeleton; track i) { <li class="px-4 py-4"><div class="h-10 animate-pulse rounded bg-muted" aria-hidden="true"></div></li> }
          } @else {
            <li class="px-4 py-8 text-center text-sm text-muted-foreground">{{ 'pedidos.empty' | t }}</li>
          }
        }
      </ul>
    </div>

    @if (nextCursor()) {
      <div class="mt-4 flex justify-center">
        <button type="button" class="btn btn-secondary" [disabled]="loading()" (click)="load(true)">{{ 'common.loadMore' | t }}</button>
      </div>
    }
  `,
})
export default class Pedidos implements OnInit {
  private readonly api = inject(DefaultService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly orders = signal<AdminOrderSummary[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly status = signal<OrderStatus | ''>('');
  protected readonly skeleton = [1, 2, 3, 4, 5];
  private seq = 0;

  protected readonly filters: { value: OrderStatus | ''; label: string }[] = [
    { value: '', label: t('common.all') },
    ...(Object.keys(STATUS_LABEL) as OrderStatus[]).map((value) => ({ value, label: STATUS_LABEL[value] })),
  ];
  protected folio = orderFolio;
  protected money = formatMxn;
  protected date = formatDateTime;

  ngOnInit() {
    // ?estado=paid llega desde el Resumen; se ignora si no es un estado conocido.
    const estado = this.route.snapshot.queryParamMap.get('estado') ?? '';
    this.status.set(Object.hasOwn(STATUS_LABEL, estado) ? (estado as OrderStatus) : '');
    return this.load(false);
  }

  protected filter(value: OrderStatus | '') {
    this.status.set(value);
    void this.router.navigate([], { queryParams: { estado: value || null }, replaceUrl: true });
    return this.load(false);
  }

  protected async load(more: boolean) {
    // Si cambian el filtro antes de que responda la consulta anterior, gana la última.
    const id = ++this.seq;
    this.loading.set(true);
    if (!more) this.orders.set([]);
    try {
      const status = this.status();
      const res = await firstValueFrom(
        this.api.adminListOrders({
          limit: 50,
          ...(status ? { status } : {}),
          ...(more && this.nextCursor() ? { cursor: this.nextCursor()! } : {}),
        }),
      );
      if (id !== this.seq) return;
      this.orders.update((list) => (more ? [...list, ...res.items] : res.items));
      this.nextCursor.set(res.next_cursor ?? null);
      this.error.set(null);
    } catch (e) {
      if (id === this.seq) this.error.set(problemMessage(e, t('pedidos.loadFailed')));
    } finally {
      if (id === this.seq) this.loading.set(false);
    }
  }
}
