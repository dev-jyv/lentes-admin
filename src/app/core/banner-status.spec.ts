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

  it('marca hasta 5 banners principales vigentes y hasta 3 secundarios', () => {
    const shown = shownBannerIds(
      [
        banner('h2', 'hero', 1),
        banner('h1', 'hero', 0, { active: false }),
        banner('h3', 'hero', 2),
        banner('h4', 'hero', 3),
        banner('h5', 'hero', 4),
        banner('h6', 'hero', 5),
        banner('h7', 'hero', 6),
        banner('s1', 'secondary', 0),
        banner('s2', 'secondary', 1),
        banner('s3', 'secondary', 2),
        banner('s4', 'secondary', 3),
      ],
      now,
    );
    expect([...shown].sort()).toEqual(['h2', 'h3', 'h4', 'h5', 'h6', 's1', 's2', 's3']);
  });

  it('marca hasta 4 tarjetas por megamenú, una por celda del mosaico y hasta 3 promesas', () => {
    const card = (id: string, menu: 'frame' | 'contact_lens', position: number) => banner(id, 'menu_card', position, { menu });
    const shown = shownBannerIds(
      [
        card('c1', 'contact_lens', 0), card('c2', 'contact_lens', 1), card('c3', 'contact_lens', 2), card('c4', 'contact_lens', 3),
        card('c5', 'contact_lens', 4), card('f1', 'frame', 5),
        banner('m1', 'mosaic', 0, { slot: 'lens_type:toric' }),
        banner('m2', 'mosaic', 1, { slot: 'lens_type:toric' }),
        banner('m3', 'mosaic', 2, { slot: 'frames', starts_at: '2026-12-01T00:00:00Z' }),
        banner('m4', 'mosaic', 3, { slot: 'frames' }),
        banner('p1', 'promise', 0), banner('p2', 'promise', 1), banner('p3', 'promise', 2), banner('p4', 'promise', 3),
      ],
      now,
    );
    expect([...shown].sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'f1', 'm1', 'm4', 'p1', 'p2', 'p3']);
  });
});
