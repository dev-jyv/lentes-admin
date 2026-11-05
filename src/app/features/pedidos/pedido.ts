import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminOrder, OrderStatus } from '../../api/generated/model';
import { formatDateTime } from '../../core/format';
import { formatMxn } from '../../core/money';
import { nextStatuses, orderFolio, requiresTracking, STATUS_LABEL } from '../../core/order-flow';
import { problemMessage } from '../../core/problem';
import { t, TPipe } from '../../core/i18n';
import { OrderStatusBadge } from '../../shared/order-status-badge';

const CARRIERS = ['Estafeta', 'DHL', 'FedEx', 'Paquetexpress', 'Redpack', 'Correos de México'];

@Component({
  selector: 'app-pedido',
  imports: [RouterLink, TPipe, OrderStatusBadge],
  template: `
    <a routerLink="/pedidos" class="back-link">{{ 'pedido.back' | t }}</a>
    @if (loadError()) { <p role="alert" class="alert-error mt-4">{{ loadError() }}</p> }
    @if (order(); as o) {
      <div class="mt-2 mb-1 flex flex-wrap items-center gap-3">
        <h1 class="page-title">{{ 'pedido.title' | t: { folio: folio(o.number) } }}</h1>
        <app-order-status-badge [status]="o.status" />
      </div>
      <p class="mb-6 text-sm text-muted-foreground">{{ o.customer_email }} · {{ 'pedido.createdAt' | t: { date: date(o.created_at) } }}@if (o.paid_at) { · {{ 'pedido.paidAt' | t: { date: date(o.paid_at) } }} }</p>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="art" class="min-w-0">
          <h2 id="art" class="mb-3 text-lg">{{ 'pedido.items' | t }}</h2>
          <div class="panel overflow-x-auto">
            <table class="data-table stack">
              <thead><tr><th scope="col">{{ 'common.product' | t }}</th><th scope="col">{{ 'pedido.eye' | t }}</th><th scope="col" class="text-right">{{ 'pedido.quantity' | t }}</th><th scope="col" class="text-right">{{ 'common.price' | t }}</th></tr></thead>
              <tbody>
                @for (l of o.items; track $index) {
                  <tr>
                    <td>{{ l.product_name }} <span class="font-normal text-muted-foreground">· {{ l.brand_name }}</span><br /><span class="text-xs font-normal text-muted-foreground"><span class="optic">{{ l.sku }}</span> {{ l.description }}</span>
                      @if (l.vision_type) { <br /><span class="text-xs text-muted-foreground">{{ 'pedido.vision' | t: { type: vision(l.vision_type) } }}</span> }
                    </td>
                    <td [attr.data-label]="'pedido.eye' | t">{{ l.category === 'frame' ? ('pedido.fullPair' | t) : eye(l.eye) }}</td>
                    <td class="text-right tabular-nums" [attr.data-label]="'pedido.quantity' | t">{{ l.quantity }}</td>
                    <td class="text-right font-semibold tabular-nums" [attr.data-label]="'common.price' | t">{{ money(l.unit_price_cents) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <dl class="panel mt-4 ml-auto max-w-xs space-y-2 p-4 text-sm tabular-nums">
            <div class="flex justify-between"><dt>{{ 'pedido.subtotal' | t }}</dt><dd>{{ money(o.subtotal_cents) }}</dd></div>
            <div class="flex justify-between"><dt>{{ 'pedido.shipping' | t }}</dt><dd>{{ money(o.shipping_cents) }}</dd></div>
            @if (o.discount_cents > 0) { <div class="flex justify-between"><dt>{{ 'pedido.discount' | t }}</dt><dd>−{{ money(o.discount_cents) }}</dd></div> }
            <div class="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>{{ 'common.total' | t }}</dt><dd>{{ money(o.total_cents) }}</dd></div>
          </dl>
        </section>

        <aside class="space-y-4">
          @if (o.refund_required) {
            <p role="alert" class="alert-error">
              <strong>{{ 'pedido.refundTitle' | t }}</strong> {{ 'pedido.refundBody' | t }}
            </p>
          }
          @if (o.prescription_id || o.glasses_prescription_id) {
            <section aria-labelledby="rx" class="panel space-y-2 p-4 text-sm">
              <h2 id="rx" class="text-base">{{ 'nav.recetas' | t }}</h2>
              @if (o.prescription_id) {
                <p>{{ 'common.contactLenses' | t }} @if (o.prescription_file_url) { · <a [href]="o.prescription_file_url" target="_blank" rel="noopener noreferrer" class="link">{{ 'pedido.viewFile' | t }}</a> }</p>
              }
              @if (o.glasses_prescription_id) {
                <p>
                  {{ 'common.frames' | t }} · {{ rxLabel(o.glasses_prescription_status) }}
                  @if (o.glasses_prescription_file_url) { · <a [href]="o.glasses_prescription_file_url" target="_blank" rel="noopener noreferrer" class="link">{{ 'pedido.viewFile' | t }}</a> }
                </p>
                <p>{{ 'pedido.pd' | t: { value: o.pd_mm != null ? ('pedido.pdValue' | t: { value: o.pd_mm }) : ('pedido.pdMissing' | t) } }}</p>
              }
            </section>
          }
          @if (o.lab_blockers.length) {
            <section aria-labelledby="lab" class="rounded-2xl bg-amber-soft p-4 text-sm">
              <h2 id="lab" class="mb-1 text-base">{{ 'pedido.labBlockers' | t }}</h2>
              <ul class="list-disc pl-4">@for (b of o.lab_blockers; track b) { <li>{{ b }}</li> }</ul>
            </section>
          }
          <section aria-labelledby="dir" class="panel p-4">
            <h2 id="dir" class="mb-2 text-base">{{ 'pedido.shipTo' | t }}</h2>
            <address class="text-sm not-italic">
              {{ o.shipping_address.recipient }}<br />
              {{ o.shipping_address.street }} {{ o.shipping_address.ext_number }}@if (o.shipping_address.int_number) { {{ 'pedido.interior' | t: { number: o.shipping_address.int_number } }} }<br />
              {{ o.shipping_address.neighborhood }}, {{ o.shipping_address.city }}<br />
              {{ o.shipping_address.state }} {{ o.shipping_address.postal_code }}<br />
              {{ 'pedido.phone' | t: { phone: o.shipping_address.phone } }}
            </address>
          </section>

          @if (o.tracking_number) {
            <section aria-labelledby="guia" class="panel p-4">
              <h2 id="guia" class="mb-2 text-base">{{ 'pedido.tracking' | t }}</h2>
              <p class="text-sm">{{ o.tracking_carrier }} · <span class="optic">{{ o.tracking_number }}</span></p>
            </section>
          }

          @if (next().length) {
            <section aria-labelledby="acc" class="panel space-y-3 p-4 ring-1 ring-primary/30">
              <h2 id="acc" class="text-base">{{ 'pedido.changeStatus' | t }}</h2>
              @if (askTracking()) {
                <div>
                  <label for="carrier" class="field-label">{{ 'pedido.carrier' | t }}</label>
                  <input id="carrier" list="carriers" class="field w-full" [value]="carrier()" (input)="carrier.set(val($event))" />
                  <datalist id="carriers">@for (c of carriers; track c) { <option [value]="c"></option> }</datalist>
                </div>
                <div>
                  <label for="tracking" class="field-label">{{ 'pedido.trackingNumber' | t }}</label>
                  <input id="tracking" class="field w-full" [value]="tracking()" (input)="tracking.set(val($event))" />
                </div>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-primary" [disabled]="busy() || !carrier().trim() || !tracking().trim()" (click)="apply('shipped')">{{ 'pedido.actions.shipped' | t }}</button>
                  <button type="button" class="btn btn-secondary" (click)="askTracking.set(false)">{{ 'common.cancel' | t }}</button>
                </div>
              } @else if (confirmCancel()) {
                <p class="text-sm">
                  {{ 'pedido.cancelWarning' | t }}
                  <strong>{{ 'pedido.noAutoRefund' | t }}</strong> {{ 'pedido.refundHint' | t }}
                </p>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-danger" [disabled]="busy()" (click)="apply('cancelled')">{{ 'pedido.confirmCancel' | t }}</button>
                  <button type="button" class="btn btn-secondary" (click)="confirmCancel.set(false)">{{ 'common.back' | t }}</button>
                </div>
              } @else {
                <div class="flex flex-wrap gap-2">
                  @for (s of next(); track s) {
                    <button type="button" class="btn btn-secondary" [disabled]="busy()" (click)="choose(s)">{{ action(s) }}</button>
                  }
                </div>
              }
              @if (error()) { <p role="alert" class="alert-error">{{ error() }}</p> }
            </section>
          }
        </aside>
      </div>
    }
  `,
})
export default class Pedido implements OnInit {
  /** :id de la ruta (withComponentInputBinding). */
  readonly id = input.required<string>();
  private readonly api = inject(DefaultService);
  protected readonly order = signal<AdminOrder | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly askTracking = signal(false);
  protected readonly confirmCancel = signal(false);
  protected readonly carrier = signal('');
  protected readonly tracking = signal('');
  protected readonly next = computed(() => {
    const o = this.order();
    return o ? nextStatuses(o.status) : [];
  });

  protected readonly carriers = CARRIERS;
  protected folio = orderFolio;
  protected money = formatMxn;
  protected date = formatDateTime;
  protected eye = (e: string) => ({ right: t('pedido.eyes.right'), left: t('pedido.eyes.left'), both: t('pedido.eyes.both') })[e] ?? e;
  protected action = (s: OrderStatus) =>
    ({ preparing: t('pedido.actions.preparing'), shipped: t('pedido.actions.shipped'), delivered: t('pedido.actions.delivered'), cancelled: t('pedido.actions.cancelled') })[s as string] ?? STATUS_LABEL[s];
  protected vision = (v: string) => ({ none: t('labels.vision.none'), single_vision: t('labels.vision.single_vision'), progressive: t('labels.vision.progressive') })[v] ?? v;
  protected rxLabel = (s: string | null | undefined) => ({ pending: t('labels.rxStatus.pending'), approved: t('labels.rxStatus.approved'), rejected: t('labels.rxStatus.rejected') })[s ?? ''] ?? '—';
  protected val = (e: Event) => (e.target as HTMLInputElement).value;

  async ngOnInit() {
    try {
      this.order.set(await firstValueFrom(this.api.adminGetOrder(this.id())));
    } catch (e) {
      this.loadError.set(problemMessage(e, t('pedido.loadFailed')));
    }
  }

  protected choose(s: OrderStatus) {
    this.error.set(null);
    if (requiresTracking(s)) return this.askTracking.set(true);
    if (s === 'cancelled') return this.confirmCancel.set(true);
    return this.apply(s);
  }

  protected async apply(status: OrderStatus) {
    this.busy.set(true);
    this.error.set(null);
    try {
      const body = requiresTracking(status)
        ? { status, tracking_carrier: this.carrier().trim(), tracking_number: this.tracking().trim() }
        : { status };
      this.order.set(await firstValueFrom(this.api.adminUpdateOrder(this.id(), body)));
      this.askTracking.set(false);
      this.confirmCancel.set(false);
    } catch (e) {
      this.error.set(problemMessage(e, t('pedido.updateFailed')));
    } finally {
      this.busy.set(false);
    }
  }
}
