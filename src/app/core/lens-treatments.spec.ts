import { describe, expect, it } from 'vitest';
import type { AdminLensTreatment } from '../api/generated/model';
import { emptyTreatmentForm, toggleVision, TREATMENT_VISIONS, treatmentFormFrom, treatmentInput, VISION_LABEL } from './lens-treatments';

const treatment: AdminLensTreatment = {
  id: 't1', name: 'Antirreflejante', slug: 'antirreflejante', description: null, icon: 'anti_reflective', badge: 'Más vendido',
  price_cents: 50000, vision_types: ['none', 'single_vision'], position: 0, active: true,
};

describe('lens-treatments', () => {
  it('nunca ofrece "Solo armazón" como necesidad de un tratamiento', () => {
    expect(TREATMENT_VISIONS).toEqual(['none', 'single_vision', 'progressive']);
    expect(VISION_LABEL.frame_only).toBe('Solo armazón');
  });

  it('marca y desmarca necesidades en el orden fijo', () => {
    expect(toggleVision([], 'progressive', true)).toEqual(['progressive']);
    expect(toggleVision(['progressive'], 'none', true)).toEqual(['none', 'progressive']);
    expect(toggleVision(['none', 'progressive'], 'none', false)).toEqual(['progressive']);
  });

  it('arma el cuerpo con pesos a centavos y opcionales en null', () => {
    const s = { ...emptyTreatmentForm(), name: ' Luz azul ', slug: 'luz-azul', icon: 'blue_light' as const, price_pesos: 349.9, vision_types: ['single_vision' as const] };
    expect(treatmentInput(s)).toEqual({
      name: 'Luz azul', slug: 'luz-azul', description: null, icon: 'blue_light', badge: null,
      price_cents: 34990, vision_types: ['single_vision'], active: true,
    });
  });

  it('exige al menos una necesidad y respeta los largos máximos', () => {
    const base = { ...emptyTreatmentForm(), name: 'Premium', slug: 'premium', price_pesos: 0 };
    expect(treatmentInput(base)).toBe('Elige al menos una necesidad visual.');
    expect(treatmentInput({ ...base, vision_types: ['frame_only'] })).toBe('Elige al menos una necesidad visual.');
    const ok = { ...base, vision_types: ['none' as const] };
    expect(typeof treatmentInput(ok)).toBe('object');
    expect(typeof treatmentInput({ ...ok, name: 'x'.repeat(61) })).toBe('string');
    expect(typeof treatmentInput({ ...ok, description: 'x'.repeat(161) })).toBe('string');
    expect(typeof treatmentInput({ ...ok, badge: 'x'.repeat(25) })).toBe('string');
    expect(typeof treatmentInput({ ...ok, price_pesos: null })).toBe('string');
    expect(typeof treatmentInput({ ...ok, price_pesos: -1 })).toBe('string');
  });

  it('carga un tratamiento existente al formulario', () => {
    expect(treatmentFormFrom(treatment)).toEqual({
      name: 'Antirreflejante', slug: 'antirreflejante', description: '', icon: 'anti_reflective', badge: 'Más vendido',
      price_pesos: 500, vision_types: ['none', 'single_vision'], active: true,
    });
  });
});
