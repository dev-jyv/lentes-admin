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

const CARRIERS = ['Estafeta', 'DHL', 'FedEx', 'Paquetexpress', 'Redpack', 'Correos de México'];

@Component({
  selector: 'app-pedido',
  imports: [RouterLink, TPipe],
  template: `
    <a routerLink="/pedidos" class="text-sm underline">{{ 'pedido.back' | t }}</a>
    @if (loadError()) { <p role="alert" class="mt-4 text-sm text-destructive">{{ loadError() }}</p> }
    @if (order(); as o) {
      <div class="my-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 class="text-2xl">{{ 'pedido.title' | t: { folio: folio(o.number) } }}</h1>
        <span class="rounded-lg bg-muted px-3 py-1 text-sm">{{ label(o.status) }}</span>
      </div>
      <p class="mb-6 text-sm text-muted-foreground">{{ o.customer_email }} · {{ 'pedido.createdAt' | t: { date: date(o.created_at) } }}@if (o.paid_at) { · {{ 'pedido.paidAt' | t: { date: date(o.paid_at) } }} }</p>

      <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="art">
          <h2 id="art" class="mb-2 font-medium">{{ 'pedido.items' | t }}</h2>
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left"><th class="py-2">{{ 'common.product' | t }}</th><th>{{ 'pedido.eye' | t }}</th><th>{{ 'pedido.quantity' | t }}</th><th class="text-right">{{ 'common.price' | t }}</th></tr></thead>
            <tbody>
              @for (l of o.items; track $index) {
                <tr class="border-b">
                  <td class="py-2">{{ l.product_name }} <span class="text-muted-foreground">· {{ l.brand_name }}</span><br /><span class="text-xs text-muted-foreground">{{ l.sku }} {{ l.description }}</span>
                    @if (l.vision_type) { <br /><span class="text-xs text-muted-foreground">{{ 'pedido.vision' | t: { type: vision(l.vision_type) } }}</span> }
                  </td>
                  <td>{{ l.category === 'frame' ? ('pedido.fullPair' | t) : eye(l.eye) }}</td><td>{{ l.quantity }}</td><td class="text-right">{{ money(l.unit_price_cents) }}</td>
                </tr>
              }
            </tbody>
          </table>
          <dl class="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div class="flex justify-between"><dt>{{ 'pedido.subtotal' | t }}</dt><dd>{{ money(o.subtotal_cents) }}</dd></div>
            <div class="flex justify-between"><dt>{{ 'pedido.shipping' | t }}</dt><dd>{{ money(o.shipping_cents) }}</dd></div>
            @if (o.discount_cents > 0) { <div class="flex justify-between"><dt>{{ 'pedido.discount' | t }}</dt><dd>−{{ money(o.discount_cents) }}</dd></div> }
            <div class="flex justify-between border-t pt-1 font-semibold"><dt>{{ 'common.total' | t }}</dt><dd>{{ money(o.total_cents) }}</dd></div>
          </dl>
        </section>

        <aside class="space-y-6">
          @if (o.refund_required) {
            <p role="alert" class="rounded-lg border border-destructive p-3 text-sm text-destructive">
              <strong>{{ 'pedido.refundTitle' | t }}</strong> {{ 'pedido.refundBody' | t }}
            </p>
          }
          @if (o.prescription_id || o.glasses_prescription_id) {
            <section aria-labelledby="rx" class="space-y-2 text-sm">
              <h2 id="rx" class="font-medium">{{ 'nav.recetas' | t }}</h2>
              @if (o.prescription_id) {
                <p>{{ 'common.contactLenses' | t }} @if (o.prescription_file_url) { · <a [href]="o.prescription_file_url" target="_blank" rel="noopener noreferrer" class="underline">{{ 'pedido.viewFile' | t }}</a> }</p>
              }
              @if (o.glasses_prescription_id) {
                <p>
                  {{ 'common.frames' | t }} · {{ rxLabel(o.glasses_prescription_status) }}
                  @if (o.glasses_prescription_file_url) { · <a [href]="o.glasses_prescription_file_url" target="_blank" rel="noopener noreferrer" class="underline">{{ 'pedido.viewFile' | t }}</a> }
                </p>
                <p>{{ 'pedido.pd' | t: { value: o.pd_mm != null ? ('pedido.pdValue' | t: { value: o.pd_mm }) : ('pedido.pdMissing' | t) } }}</p>
              }
            </section>
          }
          @if (o.lab_blockers.length) {
            <section aria-labelledby="lab" class="rounded-2xl border border-border bg-card p-3 text-sm">
              <h2 id="lab" class="mb-1 font-medium">{{ 'pedido.labBlockers' | t }}</h2>
              <ul class="list-disc pl-4">@for (b of o.lab_blockers; track b) { <li>{{ b }}</li> }</ul>
            </section>
          }
          <section aria-labelledby="dir">
            <h2 id="dir" class="mb-2 font-medium">{{ 'pedido.shipTo' | t }}</h2>
            <address class="text-sm not-italic">
              {{ o.shipping_address.recipient }}<br />
              {{ o.shipping_address.street }} {{ o.shipping_address.ext_number }}@if (o.shipping_address.int_number) { {{ 'pedido.interior' | t: { number: o.shipping_address.int_number } }} }<br />
              {{ o.shipping_address.neighborhood }}, {{ o.shipping_address.city }}<br />
              {{ o.shipping_address.state }} {{ o.shipping_address.postal_code }}<br />
              {{ 'pedido.phone' | t: { phone: o.shipping_address.phone } }}
            </address>
          </section>

          @if (o.tracking_number) {
            <section aria-labelledby="guia">
              <h2 id="guia" class="mb-2 font-medium">{{ 'pedido.tracking' | t }}</h2>
              <p class="text-sm">{{ o.tracking_carrier }} · {{ o.tracking_number }}</p>
            </section>
          }

          @if (next().length) {
            <section aria-labelledby="acc" class="space-y-3 rounded-2xl border border-border bg-card p-4">
              <h2 id="acc" class="font-medium">{{ 'pedido.changeStatus' | t }}</h2>
              @if (askTracking()) {
                <div>
                  <label for="carrier" class="mb-1 block text-sm">{{ 'pedido.carrier' | t }}</label>
                  <input id="carrier" list="carriers" class="w-full rounded-lg border border-input px-3 py-2" [value]="carrier()" (input)="carrier.set(val($event))" />
                  <datalist id="carriers">@for (c of carriers; track c) { <option [value]="c"></option> }</datalist>
                </div>
                <div>
                  <label for="tracking" class="mb-1 block text-sm">{{ 'pedido.trackingNumber' | t }}</label>
                  <input id="tracking" class="w-full rounded-lg border border-input px-3 py-2" [value]="tracking()" (input)="tracking.set(val($event))" />
                </div>
                <div class="flex gap-2">
                  <button type="button" class="rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" [disabled]="busy() || !carrier().trim() || !tracking().trim()" (click)="apply('shipped')">{{ 'pedido.actions.shipped' | t }}</button>
                  <button type="button" class="rounded-full border border-input px-3 py-2 text-sm" (click)="askTracking.set(false)">{{ 'common.cancel' | t }}</button>
                </div>
              } @else if (confirmCancel()) {
                <p class="text-sm">
                  {{ 'pedido.cancelWarning' | t }}
                  <strong>{{ 'pedido.noAutoRefund' | t }}</strong> {{ 'pedido.refundHint' | t }}
                </p>
                <div class="flex gap-2">
                  <button type="button" class="rounded-full bg-destructive px-3 py-2 text-sm text-destructive-foreground disabled:opacity-50" [disabled]="busy()" (click)="apply('cancelled')">{{ 'pedido.confirmCancel' | t }}</button>
                  <button type="button" class="rounded-full border border-input px-3 py-2 text-sm" (click)="confirmCancel.set(false)">{{ 'common.back' | t }}</button>
                </div>
              } @else {
                <div class="flex flex-wrap gap-2">
                  @for (s of next(); track s) {
                    <button type="button" class="rounded-full border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50" [disabled]="busy()" (click)="choose(s)">{{ action(s) }}</button>
                  }
                </div>
              }
              @if (error()) { <p role="alert" class="text-sm text-destructive">{{ error() }}</p> }
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
  protected label = (s: OrderStatus) => STATUS_LABEL[s];
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
