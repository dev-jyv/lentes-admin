import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { ProductCategory } from '../api/generated/model';
import type { AdminProduct, ProductInput } from '../api/generated/model';
import { testCatalogs, withHidden } from './catalogs.testing';
import {
  emptyProductForm, fromTri, productBody, productFormFrom, productFormSchema, progressiveEligible, toTri, WARRANTY,
} from './product-form';

const frame = (over: Partial<NonNullable<AdminProduct['frame']>> = {}): AdminProduct => ({
  id: 'p1', category: ProductCategory.frame, brand: { id: 'b1', name: 'B', slug: 'b' } as AdminProduct['brand'],
  name: 'Lux', slug: 'lux', description: null, lens_type: null, replacement: null, pieces_per_box: null,
  material: null, water_content_pct: null, manufacturer: null, uv_blocking: null, visibility_tint: null,
  package_note: null, requires_prescription: false, active: true,
  frame: {
    shape: 'round', material: 'metal', rim: 'full', gender: 'unisex',
    lens_width_mm: 50, bridge_mm: 18, temple_mm: 140,
    lens_height_mm: 30, frame_width_mm: 135, weight_g: 20, size: 'medium',
    spring_hinges: true, adjustable_nose_pads: false, progressive_eligible: true,
    includes: ['case', 'warranty'], warranty_months: 12, ...over,
  },
}) as AdminProduct;

/** Cuerpo válido (falla la prueba si productBody devolvió un error). */
const bodyOf = (s: Parameters<typeof productBody>[0]): ProductInput => {
  const body = productBody(s);
  if (typeof body === 'string') throw new Error(body);
  return body;
};

describe('product-form', () => {
  it('booleanos tri-estado: null, true y false ida y vuelta', () => {
    expect([null, true, false].map((v) => fromTri(toTri(v)))).toEqual([null, true, false]);
    expect(toTri(undefined)).toBe('');
  });

  it('apto para progresivos igual que la API (>= 28 mm)', () => {
    expect([progressiveEligible(null), progressiveEligible(27), progressiveEligible(28)]).toEqual([null, false, true]);
  });

  it('un armazón cargado se reenvía con todos sus campos nuevos', () => {
    expect(bodyOf(productFormFrom(frame(), testCatalogs())).frame).toEqual({
      shape: 'round', material: 'metal', rim: 'full', gender: 'unisex',
      lens_width_mm: 50, bridge_mm: 18, temple_mm: 140,
      lens_height_mm: 30, frame_width_mm: 135, weight_g: 20, size: 'medium',
      spring_hinges: true, adjustable_nose_pads: false, includes: ['case', 'warranty'], warranty_months: 12,
    });
  });

  it('un armazón sin datos nuevos envía null e includes vacío, y nunca progressive_eligible', () => {
    const p = frame({
      lens_height_mm: null, frame_width_mm: null, weight_g: null, size: null, spring_hinges: null,
      adjustable_nose_pads: null, includes: [], warranty_months: null, progressive_eligible: null,
    });
    const f = bodyOf(productFormFrom(p)).frame!;
    expect(f).toMatchObject({
      lens_height_mm: null, frame_width_mm: null, weight_g: null, size: null,
      spring_hinges: null, adjustable_nose_pads: null, includes: [], warranty_months: null,
    });
    expect('progressive_eligible' in f).toBe(false);
  });

  it('sin "garantía" no envía meses aunque haya un valor capturado', () => {
    const s = productFormFrom(frame());
    s.includes[WARRANTY] = false;
    expect(bodyOf(s).frame!.warranty_months).toBeNull();
  });

  it('un lente de contacto envía fabricante, UV, tinte y nota de empaque', () => {
    const s = { ...emptyProductForm(), brand_id: 'b1', name: 'L', slug: 'l', manufacturer: ' J&J ', uv_blocking: 'yes' as const, package_note: '' };
    expect(bodyOf(s)).toMatchObject({
      manufacturer: 'J&J', uv_blocking: true, visibility_tint: null, package_note: null,
    });
    expect('frame' in bodyOf(s)).toBe(false);
  });

  it('meses de garantía deshabilitados sin "garantía"', () => {
    const state = signal(productFormFrom(frame({ includes: [] })));
    const f = TestBed.runInInjectionContext(() => form(state, productFormSchema(() => false)));
    expect(f.warranty_months().disabled()).toBe(true);
    state.update((s) => ({ ...s, includes: { ...s.includes, [WARRANTY]: true } }));
    expect(f.warranty_months().disabled()).toBe(false);
  });

  it('un formulario nuevo propone valores visibles del catálogo, nunca uno oculto', () => {
    const c = withHidden(testCatalogs(), 'frame_shape', 'rectangular');
    const s = emptyProductForm(c);
    expect(s.shape).toBe('square');
    expect([s.frame_material, s.rim, s.gender, s.lens_type, s.replacement]).toEqual(['acetate', 'full', 'unisex', 'spherical', 'monthly']);
    expect(Object.keys(s.includes)).toEqual(testCatalogs().frame_include.map((v) => v.code));
  });

  it('un armazón con un valor oculto lo conserva al guardarse', () => {
    const c = withHidden(withHidden(testCatalogs(), 'frame_shape', 'cat_eye'), 'frame_include', 'case');
    const s = productFormFrom(frame({ shape: 'cat_eye', includes: ['case'] }), c);
    expect(bodyOf(s).frame).toMatchObject({ shape: 'cat_eye', includes: ['case'] });
  });

  it('acepta un valor nuevo del catálogo (los atributos de armazón son texto)', () => {
    const c = testCatalogs();
    c.frame_include.push({ code: 'clip_on', label: 'Clip solar', position: 7, active: true, system: false });
    const s = productFormFrom(frame({ shape: 'hexagonal', includes: [] }), c);
    s.includes['clip_on'] = true;
    expect(bodyOf(s).frame).toMatchObject({ shape: 'hexagonal', includes: ['clip_on'] });
  });
});
