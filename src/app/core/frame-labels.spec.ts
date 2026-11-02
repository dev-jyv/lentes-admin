import { describe, expect, it } from 'vitest';
import { FrameColor, FrameGender, FrameMaterial, FrameRim, FrameShape, ProductCategory } from '../api/generated/model';
import { CATEGORY_LABEL, COLOR_LABEL, GENDER_LABEL, MATERIAL_LABEL, RIM_LABEL, SHAPE_LABEL, toOptions } from './frame-labels';

describe('frame-labels', () => {
  it('tiene etiqueta para cada valor del contrato', () => {
    const cases: [object, Record<string, string>][] = [
      [ProductCategory, CATEGORY_LABEL],
      [FrameShape, SHAPE_LABEL],
      [FrameMaterial, MATERIAL_LABEL],
      [FrameRim, RIM_LABEL],
      [FrameGender, GENDER_LABEL],
      [FrameColor, COLOR_LABEL],
    ];
    for (const [values, labels] of cases) {
      for (const v of Object.values(values) as string[]) expect(labels[v], v).toBeTruthy();
    }
  });

  it('toOptions conserva valor y etiqueta', () => {
    expect(toOptions({ a: 'A' })).toEqual([{ value: 'a', label: 'A' }]);
  });
});
