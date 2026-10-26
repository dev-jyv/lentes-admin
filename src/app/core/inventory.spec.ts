import { describe, expect, it } from 'vitest';
import { move, validateImage } from './images';
import { lastDays, pct } from './stats';
import { validateAdjustment } from './stock';

describe('validateAdjustment', () => {
  it('rechaza 0, no enteros y vacío', () => {
    expect(validateAdjustment(0, 'receipt', '', 5)).toContain('0');
    expect(validateAdjustment(1.5, 'receipt', '', 5)).toContain('entera');
    expect(validateAdjustment(null, 'receipt', '', 5)).toContain('entera');
  });

  it('no deja la existencia negativa', () => {
    expect(validateAdjustment(-6, 'damage', '', 5)).toContain('negativa');
    expect(validateAdjustment(-5, 'damage', '', 5)).toBeNull();
  });

  it('el motivo "otro" exige nota', () => {
    expect(validateAdjustment(2, 'other', '  ', 0)).toContain('nota');
    expect(validateAdjustment(2, 'other', 'caja encontrada', 0)).toBeNull();
  });
});

describe('images', () => {
  it('valida tipo y tamaño', () => {
    expect(validateImage({ name: 'a.gif', type: 'image/gif', size: 10 })).toContain('JPG');
    expect(validateImage({ name: 'a.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 })).toContain('5 MB');
    expect(validateImage({ name: 'a.webp', type: 'image/webp', size: 1000 })).toBeNull();
  });

  it('move intercambia y respeta los bordes', () => {
    expect(move(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(move(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  it('move no muta el original', () => {
    const src = ['a', 'b'];
    move(src, 0, 1);
    expect(src).toEqual(['a', 'b']);
  });
});

describe('stats', () => {
  it('pct devuelve null sin base', () => {
    expect(pct(3, 0)).toBeNull();
    expect(pct(1, 3)).toBe('33.3%');
  });

  it('lastDays incluye hoy', () => {
    expect(lastDays(30, new Date('2026-10-26T12:00:00Z'))).toEqual({ from: '2026-09-27', to: '2026-10-26' });
    expect(lastDays(1, new Date('2026-10-26T12:00:00Z'))).toEqual({ from: '2026-10-26', to: '2026-10-26' });
  });
});
