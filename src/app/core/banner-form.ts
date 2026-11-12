import { BannerPlacement, HeroArt, ProductCategory, PromiseIcon } from '../api/generated/model';
import type { AdminHomeBanner, HomeBannerInput } from '../api/generated/model';
import { cdmxInputToUtc, utcToCdmxInput } from './cdmx-time';
import { move } from './images';
import { t } from './i18n';

// Reglas por ubicación de los banners de toda la tienda (SPEC 02 y SPEC 15). La API valida lo mismo (400);
// aquí se usan para pedir solo los campos de la ubicación elegida y avisar antes de enviar.

/** Celdas del mosaico del home, en el orden en que se dibujan. */
export const MOSAIC_SLOTS = [
  'frames', 'contact_lens', 'reorder',
  'lens_type:spherical', 'lens_type:toric', 'lens_type:multifocal', 'lens_type:cosmetic',
] as const;
export type MosaicSlot = (typeof MOSAIC_SLOTS)[number];

/** La celda de reposición no lleva foto: título, subtítulo y enlace fijo a /cuenta/pedidos. */
export const REORDER_SLOT = 'reorder';

export const PROMISE_ICONS = Object.values(PromiseIcon);
export const HERO_ARTS = Object.values(HeroArt);

/** Cuántas tarjetas vigentes muestra cada megamenú. */
export const MAX_MENU_CARDS = 4;
/** Cuántas promesas vigentes muestra la franja. */
export const MAX_PROMISES = 3;

export type HeroMode = 'image' | 'art';

export interface BannerForm {
  placement: BannerPlacement;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  image_alt: string;
  menu: ProductCategory | '';
  slot: string;
  icon: PromiseIcon | '';
  art: HeroArt | '';
  /** Solo en `hero`: con imagen o con ilustración de marca. */
  hero_mode: HeroMode;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

export const emptyBannerForm = (placement: BannerPlacement = BannerPlacement.promo_bar, extra: Partial<BannerForm> = {}): BannerForm => ({
  placement, title: '', subtitle: '', cta_label: '', cta_href: '', image_alt: '',
  menu: '', slot: '', icon: '', art: '', hero_mode: 'image',
  starts_at: '', ends_at: '', active: true, ...extra,
});

export const bannerFormFrom = (b: AdminHomeBanner): BannerForm => ({
  placement: b.placement, title: b.title, subtitle: b.subtitle ?? '', cta_label: b.cta_label ?? '', cta_href: b.cta_href ?? '',
  image_alt: b.image_alt ?? '', menu: b.menu ?? '', slot: b.slot ?? '', icon: b.icon ?? '', art: b.art ?? '',
  hero_mode: b.placement === BannerPlacement.hero && !b.image_key ? 'art' : 'image',
  starts_at: utcToCdmxInput(b.starts_at), ends_at: utcToCdmxInput(b.ends_at), active: b.active,
});

type Need = 'required' | 'optional' | null;

/** Campos que pide el formulario según la ubicación; `null` = no se pide (y se envía vacío). */
export interface BannerFields {
  title: Need;
  titleMax: number;
  subtitle: Need;
  subtitleMax: number;
  ctaLabel: Need;
  ctaHref: Need;
  /** Imagen y su descripción. */
  image: Need;
  menu: boolean;
  slot: boolean;
  icon: boolean;
  /** `hero`: elegir entre imagen o ilustración. */
  heroMode: boolean;
  art: boolean;
}

const NONE: BannerFields = {
  title: null, titleMax: 120, subtitle: null, subtitleMax: 240, ctaLabel: null, ctaHref: null, image: null,
  menu: false, slot: false, icon: false, heroMode: false, art: false,
};

export function bannerFields(s: Pick<BannerForm, 'placement' | 'slot' | 'hero_mode'>): BannerFields {
  switch (s.placement) {
    case BannerPlacement.promo_bar:
      return { ...NONE, title: 'required', titleMax: 90, ctaLabel: 'optional', ctaHref: 'optional' };
    case BannerPlacement.hero: {
      const art = s.hero_mode === 'art';
      return {
        ...NONE, title: 'required', subtitle: 'optional', ctaLabel: 'required', ctaHref: 'required',
        heroMode: true, image: art ? null : 'required', art,
      };
    }
    case BannerPlacement.secondary:
      return { ...NONE, title: 'required', subtitle: 'optional', ctaLabel: 'required', ctaHref: 'required', image: 'required' };
    case BannerPlacement.menu_card:
      return { ...NONE, menu: true, title: 'required', titleMax: 40, ctaHref: 'required', image: 'required' };
    case BannerPlacement.mosaic:
      // La etiqueta y el enlace de una celda con foto salen del catálogo, para que no se desalineen del filtro.
      return s.slot === REORDER_SLOT
        ? { ...NONE, slot: true, title: 'required', titleMax: 40, subtitle: 'optional', subtitleMax: 80 }
        : { ...NONE, slot: true, image: s.slot ? 'required' : null };
    case BannerPlacement.promise:
      return { ...NONE, icon: true, title: 'required', titleMax: 60 };
    default:
      return NONE;
  }
}

const text = (need: Need, v: string) => (need ? v.trim() || null : null);

/**
 * Cuerpo para crear o editar un banner, o un texto de error. Envía `null` en todo lo que la ubicación no admite,
 * para que un cambio de ubicación no arrastre campos que la API rechazaría.
 */
export function bannerBody(s: BannerForm, imageKey: string | null): HomeBannerInput | string {
  const f = bannerFields(s);
  const title = s.title.trim();
  if (f.menu && !s.menu) return t('homeAdmin.errors.menu');
  if (f.slot && !(MOSAIC_SLOTS as readonly string[]).includes(s.slot)) return t('homeAdmin.errors.slot');
  if (f.icon && !s.icon) return t('homeAdmin.errors.icon');
  if (f.art && !s.art) return t('homeAdmin.errors.art');
  if (f.title === 'required' && !title) return t('common.checkRequired');
  if (f.title && title.length > f.titleMax) return t('homeAdmin.errors.titleMax', { max: f.titleMax });
  if (f.subtitle && s.subtitle.trim().length > f.subtitleMax) return t('homeAdmin.errors.subtitleMax', { max: f.subtitleMax });
  const label = s.cta_label.trim();
  const href = s.cta_href.trim();
  if ((f.ctaLabel === 'required' && !label) || (f.ctaHref === 'required' && !href)) return t('homeAdmin.errors.cta');
  if (f.ctaLabel === 'optional' && f.ctaHref === 'optional' && !!label !== !!href) return t('homeAdmin.errors.ctaPair');
  if (f.image === 'required' && (!imageKey || !s.image_alt.trim())) return t('homeAdmin.errors.image');
  return {
    placement: s.placement,
    title: f.title ? title : '',
    subtitle: text(f.subtitle, s.subtitle),
    cta_label: text(f.ctaLabel, s.cta_label),
    cta_href: text(f.ctaHref, s.cta_href),
    image_key: f.image ? imageKey : null,
    image_alt: text(f.image, s.image_alt),
    menu: f.menu ? (s.menu as ProductCategory) : null,
    slot: f.slot ? s.slot : null,
    icon: f.icon ? (s.icon as PromiseIcon) : null,
    art: f.art ? (s.art as HeroArt) : null,
    active: s.active,
    starts_at: cdmxInputToUtc(s.starts_at),
    ends_at: cdmxInputToUtc(s.ends_at),
  };
}

/**
 * Orden completo de una ubicación tras mover un banner dentro de un subgrupo (por ejemplo, las tarjetas de un solo
 * megamenú). La API reordena por ubicación y exige todos sus banners, así que los demás conservan su lugar.
 */
export function reorderWithin<T extends { id: string }>(all: readonly T[], inGroup: (b: T) => boolean, index: number, dir: -1 | 1): string[] {
  const moved = move(all.filter(inGroup), index, dir);
  let k = 0;
  return all.map((b) => (inGroup(b) ? moved[k++].id : b.id));
}
