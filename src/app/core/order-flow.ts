import type { OrderStatus } from '../api/generated/model';
import { t } from './i18n';

export const STATUS_LABEL: Record<OrderStatus, string> = t('labels.orderStatus', { returnObjects: true });

/**
 * Transiciones que el panel ofrece. La API es la autoridad (responde 409 si no es válida).
 * Reembolsos quedan fuera: el flujo con Mercado Pago está pendiente de decidir.
 */
const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  paid: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};

export const nextStatuses = (status: OrderStatus): OrderStatus[] => NEXT[status] ?? [];

/** Pasar a "enviado" exige paquetería y número de guía. */
export const requiresTracking = (to: OrderStatus): boolean => to === 'shipped';

export const orderFolio = (n: number): string => `LC-${String(n).padStart(6, '0')}`;
