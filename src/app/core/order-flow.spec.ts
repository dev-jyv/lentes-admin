import { describe, expect, it } from 'vitest';
import { nextStatuses, orderFolio, requiresTracking } from './order-flow';

describe('order-flow', () => {
  it('sigue el flujo pagado → preparando → enviado → entregado', () => {
    expect(nextStatuses('paid')).toEqual(['preparing', 'cancelled']);
    expect(nextStatuses('preparing')).toEqual(['shipped', 'cancelled']);
    expect(nextStatuses('shipped')).toEqual(['delivered']);
  });

  it('estados finales o sin acción no ofrecen transiciones', () => {
    for (const s of ['pending_payment', 'delivered', 'cancelled', 'refunded', 'expired'] as const) {
      expect(nextStatuses(s)).toEqual([]);
    }
  });

  it('nunca ofrece reembolso desde el panel', () => {
    for (const s of ['paid', 'preparing', 'shipped'] as const) {
      expect(nextStatuses(s)).not.toContain('refunded');
    }
  });

  it('solo enviar exige guía', () => {
    expect(requiresTracking('shipped')).toBe(true);
    expect(requiresTracking('preparing')).toBe(false);
  });

  it('folio con 6 dígitos', () => {
    expect(orderFolio(123)).toBe('LC-000123');
  });
});
