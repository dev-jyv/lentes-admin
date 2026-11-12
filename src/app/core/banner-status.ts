import type { AdminHomeBanner } from '../api/generated/model';

export type BannerStatus = 'Vigente' | 'Programado' | 'Vencido' | 'Inactivo';

export function bannerStatus(b: Pick<AdminHomeBanner, 'active' | 'starts_at' | 'ends_at'>, now: Date = new Date()): BannerStatus {
  if (!b.active) return 'Inactivo';
  if (b.ends_at && new Date(b.ends_at) <= now) return 'Vencido';
  if (b.starts_at && new Date(b.starts_at) > now) return 'Programado';
  return 'Vigente';
}

/** Cuántos banners vigentes muestra la tienda por ubicación (igual que `GET /v1/home`). */
const SHOWN: Record<AdminHomeBanner['placement'], number> = {
  promo_bar: 1, hero: 5, secondary: 3,
  // SPEC 15: hasta 4 tarjetas por megamenú, una por celda del mosaico y hasta 3 promesas.
  menu_card: 4, mosaic: 1, promise: 3,
};

/** Grupo en el que compite un banner: las tarjetas por menú y el mosaico por celda. */
const groupOf = (b: AdminHomeBanner): string => {
  if (b.placement === 'menu_card') return `menu_card:${b.menu ?? ''}`;
  if (b.placement === 'mosaic') return `mosaic:${b.slot ?? ''}`;
  return b.placement;
};

/** Ids de los banners que la tienda muestra ahora, según vigencia y posición. */
export function shownBannerIds(banners: readonly AdminHomeBanner[], now: Date = new Date()): Set<string> {
  const used: Record<string, number> = {};
  const shown = new Set<string>();
  for (const b of [...banners].sort((x, y) => x.position - y.position)) {
    if (bannerStatus(b, now) !== 'Vigente') continue;
    const group = groupOf(b);
    const n = used[group] ?? 0;
    if (n < SHOWN[b.placement]) shown.add(b.id);
    used[group] = n + 1;
  }
  return shown;
}
