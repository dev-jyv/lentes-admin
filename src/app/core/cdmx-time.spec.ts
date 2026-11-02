import { describe, expect, it } from 'vitest';
import { cdmxInputToUtc, utcToCdmxInput } from './cdmx-time';

describe('cdmx-time', () => {
  it('09:00 en la Ciudad de México se guarda como 15:00 UTC', () => {
    expect(cdmxInputToUtc('2026-11-02T09:00')).toBe('2026-11-02T15:00:00.000Z');
  });

  it('cruza de día correctamente', () => {
    expect(cdmxInputToUtc('2026-12-31T22:30')).toBe('2027-01-01T04:30:00.000Z');
  });

  it('muestra en hora de la Ciudad de México', () => {
    expect(utcToCdmxInput('2026-11-02T15:00:00Z')).toBe('2026-11-02T09:00');
  });

  it('ida y vuelta conservan el valor', () => {
    expect(utcToCdmxInput(cdmxInputToUtc('2026-06-15T18:45'))).toBe('2026-06-15T18:45');
  });

  it('vacío o inválido da null', () => {
    expect(cdmxInputToUtc('')).toBeNull();
    expect(cdmxInputToUtc('mañana')).toBeNull();
    expect(utcToCdmxInput(null)).toBe('');
  });
});
