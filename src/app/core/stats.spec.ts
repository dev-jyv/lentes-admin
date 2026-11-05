import { describe, expect, it } from 'vitest';
import { fillDays, lastDays, pct } from './stats';

describe('stats', () => {
  it('pct devuelve null sin base', () => {
    expect(pct(1, 0)).toBeNull();
    expect(pct(1, 4)).toBe('25.0%');
  });

  it('lastDays incluye hoy', () => {
    expect(lastDays(7, new Date('2026-11-05T12:00:00Z'))).toEqual({ from: '2026-10-30', to: '2026-11-05' });
  });

  it('fillDays rellena con cero los días sin ventas y respeta el orden', () => {
    const days = fillDays([{ date: '2026-11-02', orders: 2, revenue_cents: 500 }], '2026-11-01', '2026-11-03');
    expect(days).toEqual([
      { date: '2026-11-01', orders: 0, revenue_cents: 0 },
      { date: '2026-11-02', orders: 2, revenue_cents: 500 },
      { date: '2026-11-03', orders: 0, revenue_cents: 0 },
    ]);
  });
});
