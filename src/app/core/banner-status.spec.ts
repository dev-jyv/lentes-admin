import { describe, expect, it } from 'vitest';
import type { AdminHomeBanner } from '../api/generated/model';
import { bannerStatus, shownBannerIds } from './banner-status';

const now = new Date('2026-11-02T12:00:00Z');
const banner = (id: string, placement: AdminHomeBanner['placement'], position: number, extra: Partial<AdminHomeBanner> = {}) =>
  ({ id, placement, position, active: true, starts_at: null, ends_at: null, ...extra }) as AdminHomeBanner;

describe('banner-status', () => {
  it('calcula el estado', () => {
    expect(bannerStatus(banner('a', 'hero', 0), now)).toBe('Vigente');
    expect(bannerStatus(banner('a', 'hero', 0, { active: false }), now)).toBe('Inactivo');
    expect(bannerStatus(banner('a', 'hero', 0, { starts_at: '2026-11-03T00:00:00Z' }), now)).toBe('Programado');
    expect(bannerStatus(banner('a', 'hero', 0, { ends_at: '2026-11-01T00:00:00Z' }), now)).toBe('Vencido');
    expect(bannerStatus(banner('a', 'hero', 0, { ends_at: '2026-11-02T12:00:00Z' }), now)).toBe('Vencido');
  });

  it('marca el primero vigente por ubicación y hasta 3 secundarios', () => {
    const shown = shownBannerIds(
      [
        banner('h2', 'hero', 1),
        banner('h1', 'hero', 0, { active: false }),
        banner('h3', 'hero', 2),
        banner('s1', 'secondary', 0),
        banner('s2', 'secondary', 1),
        banner('s3', 'secondary', 2),
        banner('s4', 'secondary', 3),
      ],
      now,
    );
    expect([...shown].sort()).toEqual(['h2', 's1', 's2', 's3']);
  });
});
