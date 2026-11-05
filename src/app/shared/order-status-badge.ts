import { Component, computed, input } from '@angular/core';
import type { OrderStatus } from '../api/generated/model';
import { STATUS_LABEL } from '../core/order-flow';

// El color va solo en el punto; el texto conserva el color de tinta para cumplir contraste AA.
const DOT: Record<OrderStatus, string> = {
  pending_payment: 'bg-muted-foreground',
  paid: 'bg-amber',
  preparing: 'bg-primary',
  shipped: 'bg-primary',
  delivered: 'bg-good',
  cancelled: 'bg-destructive',
  refunded: 'bg-muted-foreground',
  expired: 'bg-muted-foreground',
};

@Component({
  selector: 'app-order-status-badge',
  template: `<span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium whitespace-nowrap"
    ><span class="size-1.5 shrink-0 rounded-full {{ dot() }}" aria-hidden="true"></span>{{ label() }}</span
  >`,
})
export class OrderStatusBadge {
  readonly status = input.required<OrderStatus>();
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
  protected readonly dot = computed(() => DOT[this.status()]);
}
