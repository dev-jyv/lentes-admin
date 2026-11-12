import { describe, expect, it } from 'vitest';
import { ProductCategory } from '../api/generated/model';
import { CATEGORY_LABEL, toOptions } from './frame-labels';

describe('frame-labels', () => {
  it('tiene etiqueta para cada categoría del contrato', () => {
    for (const v of Object.values(ProductCategory)) expect(CATEGORY_LABEL[v], v).toBeTruthy();
  });

  it('toOptions conserva valor y etiqueta', () => {
    expect(toOptions({ a: 'A' })).toEqual([{ value: 'a', label: 'A' }]);
  });
});
