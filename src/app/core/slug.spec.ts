import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('quita acentos y símbolos', () => {
    expect(slugify('Acuvue Oasys 1-Day')).toBe('acuvue-oasys-1-day');
    expect(slugify('  Óptica Ñandú!  ')).toBe('optica-nandu');
  });
});
