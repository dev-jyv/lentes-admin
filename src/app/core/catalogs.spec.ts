import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DefaultService } from '../api/generated/default/default.service';
import {
  catalogCode, catalogLabel, catalogOptions, CatalogStore, catalogValueInput, catalogValuePatch, defaultCode, isFixedCatalog,
  normalizeSwatch, readableCode,
} from './catalogs';
import { testCatalogs, withHidden } from './catalogs.testing';

describe('catalogs', () => {
  it('genera el código igual que la API', () => {
    expect(catalogCode('Ojo de gato')).toBe('ojo_de_gato');
    expect(catalogCode('  Geométrico / Hexágono ')).toBe('geometrico_hexagono');
    expect(catalogCode('Niñ@s')).toBe('nins');
    expect(catalogCode('a'.repeat(45))).toHaveLength(40);
  });

  it('código legible como respaldo de la etiqueta', () => {
    expect(readableCode('cat_eye')).toBe('Cat eye');
    expect(catalogLabel(testCatalogs().frame_shape, 'cat_eye')).toBe('Ojo de gato');
    expect(catalogLabel(testCatalogs().frame_shape, 'hexagonal')).toBe('Hexagonal');
    expect(catalogLabel(undefined, 'blue_light')).toBe('Blue light');
    expect(catalogLabel(undefined, null)).toBe('—');
  });

  it('las opciones omiten los ocultos salvo el que el producto ya tiene, marcado "(oculto)"', () => {
    const shapes = withHidden(testCatalogs(), 'frame_shape', 'oval').frame_shape;
    expect(catalogOptions(shapes).map((o) => o.value)).not.toContain('oval');
    const kept = catalogOptions(shapes, 'oval').find((o) => o.value === 'oval');
    expect(kept).toEqual({ value: 'oval', label: 'Ovalado (oculto)', hidden: true });
    expect(catalogOptions(shapes, ['oval']).map((o) => o.value)).toEqual(['rectangular', 'square', 'round', 'oval', 'cat_eye']);
  });

  it('las opciones siguen el orden de position', () => {
    const shapes = testCatalogs().frame_shape.map((v) => (v.code === 'cat_eye' ? { ...v, position: -1 } : v));
    expect(catalogOptions(shapes)[0].value).toBe('cat_eye');
  });

  it('el valor por omisión es el preferido si está visible; si no, el primero visible', () => {
    const c = testCatalogs();
    expect(defaultCode(c.replacement, 'monthly')).toBe('monthly');
    expect(defaultCode(withHidden(c, 'replacement', 'monthly').replacement, 'monthly')).toBe('daily');
    expect(defaultCode(undefined, 'monthly')).toBe('monthly');
  });

  it('valida la muestra de color como la API', () => {
    expect(normalizeSwatch('#AABBCC')).toBe('#aabbcc');
    expect(normalizeSwatch('conic-gradient(#ff0000,#00FF00, #0000ff)')).toBe('conic-gradient(#ff0000, #00ff00, #0000ff)');
    expect(normalizeSwatch('red')).toBeNull();
    expect(normalizeSwatch('conic-gradient(#ff0000)')).toBeNull();
    expect(normalizeSwatch('linear-gradient(#ff0000, #00ff00)')).toBeNull();
  });

  it('tipo de lente y reemplazo no admiten valores nuevos', () => {
    expect(isFixedCatalog('lens_type')).toBe(true);
    expect(isFixedCatalog('frame_shape')).toBe(false);
    expect(catalogValueInput('lens_type', { label: 'Esclerales', code: '', swatch: '' })).toBeTypeOf('string');
    expect(catalogValueInput('replacement', { label: 'Semanal', code: '', swatch: '' })).toBeTypeOf('string');
  });

  it('un color nuevo exige muestra; los demás catálogos no la envían', () => {
    expect(catalogValueInput('frame_color', { label: 'Verde olivo', code: '', swatch: '' })).toBe('Un color nuevo necesita su muestra de color.');
    expect(catalogValueInput('frame_color', { label: 'Verde olivo', code: '', swatch: 'verde' })).toBeTypeOf('string');
    expect(catalogValueInput('frame_color', { label: 'Verde olivo', code: '', swatch: '#556B2F' })).toEqual({ label: 'Verde olivo', code: 'verde_olivo', swatch: '#556b2f' });
    expect(catalogValueInput('frame_shape', { label: 'Hexagonal', code: '', swatch: '#000000' })).toEqual({ label: 'Hexagonal', code: 'hexagonal' });
  });

  it('valida etiqueta y código', () => {
    expect(catalogValueInput('frame_shape', { label: ' ', code: '', swatch: '' })).toBeTypeOf('string');
    expect(catalogValueInput('frame_shape', { label: 'x'.repeat(41), code: '', swatch: '' })).toBeTypeOf('string');
    expect(catalogValueInput('frame_shape', { label: 'Hexagonal', code: '9hex', swatch: '' })).toBeTypeOf('string');
    expect(catalogValueInput('frame_shape', { label: 'Hexagonal', code: 'hexa', swatch: '' })).toEqual({ label: 'Hexagonal', code: 'hexa' });
  });

  it('editar no cambia el código y solo envía la muestra en color', () => {
    expect(catalogValuePatch('lens_type', { label: 'Para astigmatismo', code: 'toric', swatch: '' })).toEqual({ label: 'Para astigmatismo' });
    expect(catalogValuePatch('frame_color', { label: 'Negro', code: 'black', swatch: '#000000' })).toEqual({ label: 'Negro', swatch: '#000000' });
  });
});

describe('CatalogStore', () => {
  const setup = (adminListCatalogs: () => unknown) => {
    TestBed.configureTestingModule({ providers: [{ provide: DefaultService, useValue: { adminListCatalogs } }] });
    return TestBed.inject(CatalogStore);
  };

  it('pide el catálogo una sola vez por sesión, salvo que se fuerce', async () => {
    let calls = 0;
    const store = setup(() => (calls++, of(testCatalogs())));
    await Promise.all([store.load(), store.load()]);
    await store.load();
    expect(calls).toBe(1);
    await store.load(true);
    expect(calls).toBe(2);
    expect(store.label('lens_type', 'toric')).toBe('Tórico');
  });

  it('mantiene los cambios de la pantalla Catálogos en memoria', async () => {
    const store = setup(() => of(testCatalogs()));
    await store.load();
    store.upsert('frame_shape', { code: 'hexagonal', label: 'Hexagonal', position: 5, active: true, system: false, product_count: 0 });
    store.upsert('lens_type', { ...store.values('lens_type')[1], label: 'Para astigmatismo' });
    store.remove('frame_shape', 'oval');
    expect(store.options('frame_shape').map((o) => o.value)).toEqual(['rectangular', 'square', 'round', 'cat_eye', 'hexagonal']);
    expect(store.label('lens_type', 'toric')).toBe('Para astigmatismo');
  });

  it('si la API falla, deja el error y responde null', async () => {
    const store = setup(() => throwError(() => new Error('x')));
    expect(await store.load()).toBeNull();
    expect(store.error()).toBe('No se pudieron cargar los catálogos.');
  });
});
