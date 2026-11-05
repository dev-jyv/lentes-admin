import { inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../api/generated/default/default.service';
import type { LowStockItem } from '../api/generated/model';

/** Cuenta para mostrar: "50+" cuando la API tiene más páginas; null mientras no se sabe. */
export const countLabel = (count: number | null, more = false): string | null =>
  count === null ? null : more ? `${count}+` : String(count);

const PAGE = 50;
const MIN_INTERVAL_MS = 30_000;

/** Pendientes del equipo (pedidos por preparar, recetas en revisión, stock bajo) para el menú y el resumen. */
@Service()
export class AttentionService {
  private readonly api = inject(DefaultService);
  private last = 0;

  readonly toShip = signal<string | null>(null);
  readonly toShipCount = signal(0);
  readonly rxPending = signal<string | null>(null);
  readonly rxPendingCount = signal(0);
  /** Variantes bajo el umbral por defecto de la API; null mientras no se sabe. */
  readonly lowStock = signal<LowStockItem[] | null>(null);
  /** Alguna de las tres consultas falló en la última actualización. */
  readonly failed = signal(false);

  /** Sin `force`, no repite la consulta si la anterior fue hace menos de 30 s (se llama en cada navegación). */
  async refresh(force = false) {
    if (!force && Date.now() - this.last < MIN_INTERVAL_MS) return;
    this.last = Date.now();
    const [orders, rx, low] = await Promise.allSettled([
      firstValueFrom(this.api.adminListOrders({ status: 'paid', limit: PAGE })),
      firstValueFrom(this.api.adminListPrescriptions({ status: 'pending' })),
      firstValueFrom(this.api.adminListLowStock()),
    ]);
    // Un fallo deja el valor anterior: el menú no debe parpadear por un error de red.
    if (orders.status === 'fulfilled') {
      this.toShipCount.set(orders.value.items.length);
      this.toShip.set(countLabel(orders.value.items.length, !!orders.value.next_cursor));
    }
    if (rx.status === 'fulfilled') {
      this.rxPendingCount.set(rx.value.items.length);
      this.rxPending.set(countLabel(rx.value.items.length));
    }
    if (low.status === 'fulfilled') this.lowStock.set(low.value.items);
    this.failed.set([orders, rx, low].some((r) => r.status === 'rejected'));
  }
}
