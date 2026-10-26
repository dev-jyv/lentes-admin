import { describe, expect, it } from 'vitest';
import { centsToPesos, formatMxn, pesosToCents } from './money';

describe('money', () => {
  it('convierte pesos a centavos enteros sin error de float', () => {
    expect(pesosToCents(19.99)).toBe(1999);
    expect(pesosToCents(0.1 + 0.2)).toBe(30);
    expect(Number.isInteger(pesosToCents(459.9))).toBe(true);
  });

  it('ida y vuelta', () => {
    expect(centsToPesos(pesosToCents(529))).toBe(529);
  });

  it('formatea centavos como MXN', () => {
    expect(formatMxn(52900)).toContain('529.00');
  });
});
