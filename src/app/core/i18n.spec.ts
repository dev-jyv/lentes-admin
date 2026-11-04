import { describe, expect, it } from 'vitest';
import { t, TPipe } from './i18n';

describe('i18n', () => {
  it('resuelve claves e interpola la marca por defecto', () => {
    expect(t('meta.title')).toBe('Pupila · Admin');
  });

  it('no escapa valores: Angular ya lo hace al pintar', () => {
    expect(t('micas.moveUp', { name: 'A & B' })).toBe('Subir A & B');
  });

  it('el pipe usa las mismas traducciones', () => {
    expect(new TPipe().transform('pedido.title', { folio: 'LC-000001' })).toBe('Pedido LC-000001');
  });
});
