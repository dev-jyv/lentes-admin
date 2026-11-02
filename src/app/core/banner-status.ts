import type { AdminHomeBanner } from '../api/generated/model';

export type BannerStatus = 'Vigente' | 'Programado' | 'Vencido' | 'Inactivo';

export function bannerStatus(b: Pick<AdminHomeBanner, 'active' | 'starts_at' | 'ends_at'>, now: Date = new Date()): BannerStatus {
  if (!b.active) return 'Inactivo';
  if (b.ends_at && new Date(b.ends_at) <= now) return 'Vencido';
  if (b.starts_at && new Date(b.starts_at) > now) return 'Programado';
  return 'Vigente';
}

/** Cuántos banners vigentes muestra la tienda por ubicación. */
const SHOWN: Record<AdminHomeBanner['placement'], number> = { promo_bar: 1, hero: 1, secondary: 3 };

/** Ids de los banners que la tienda muestra ahora, según vigencia y posición. */
export function shownBannerIds(banners: readonly AdminHomeBanner[], now: Date = new Date()): Set<string> {
  const used: Record<string, number> = {};
  const shown = new Set<string>();
  for (const b of [...banners].sort((x, y) => x.position - y.position)) {
    if (bannerStatus(b, now) !== 'Vigente') continue;
    const n = used[b.placement] ?? 0;
    if (n < SHOWN[b.placement]) shown.add(b.id);
    used[b.placement] = n + 1;
  }
  return shown;
}
