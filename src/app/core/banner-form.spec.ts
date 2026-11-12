import { describe, expect, it } from 'vitest';
import type { AdminHomeBanner, HomeBannerInput } from '../api/generated/model';
import { bannerBody, bannerFields, bannerFormFrom, emptyBannerForm, reorderWithin, type BannerForm } from './banner-form';

const body = (s: BannerForm, key: string | null = null): HomeBannerInput => {
  const b = bannerBody(s, key);
  if (typeof b === 'string') throw new Error(b);
  return b;
};

describe('banner-form', () => {
  it('pide solo los campos de cada ubicación', () => {
    expect(bannerFields(emptyBannerForm('menu_card'))).toMatchObject({ menu: true, title: 'required', titleMax: 40, ctaHref: 'required', ctaLabel: null, subtitle: null, image: 'required' });
    expect(bannerFields(emptyBannerForm('promise'))).toMatchObject({ icon: true, title: 'required', titleMax: 60, image: null, ctaHref: null });
    expect(bannerFields(emptyBannerForm('mosaic', { slot: 'lens_type:toric' }))).toMatchObject({ slot: true, title: null, image: 'required', ctaHref: null });
    expect(bannerFields(emptyBannerForm('mosaic', { slot: 'reorder' }))).toMatchObject({ title: 'required', titleMax: 40, subtitle: 'optional', subtitleMax: 80, image: null });
    expect(bannerFields(emptyBannerForm('hero', { hero_mode: 'art' }))).toMatchObject({ heroMode: true, art: true, image: null, ctaLabel: 'required' });
    expect(bannerFields(emptyBannerForm('hero'))).toMatchObject({ art: false, image: 'required' });
  });

  it('tarjeta del megamenú: exige menú, enlace e imagen; no envía subtítulo ni texto del enlace', () => {
    const s = emptyBannerForm('menu_card', { title: 'Para ella', cta_href: '/armazones?gender=women', subtitle: 'x', cta_label: 'y' });
    expect(bannerBody(s, 'home/a.png')).toBe('Elige el megamenú de la tarjeta.');
    s.menu = 'frame';
    expect(bannerBody(s, null)).toBe('Sube la imagen y escribe su descripción.');
    s.image_alt = 'Armazones';
    expect(body(s, 'home/a.png')).toMatchObject({ menu: 'frame', subtitle: null, cta_label: null, image_key: 'home/a.png', slot: null, icon: null, art: null });
    s.title = 'x'.repeat(41);
    expect(bannerBody(s, 'home/a.png')).toBe('El título admite hasta 40 caracteres aquí.');
  });

  it('mosaico con foto: sin título ni enlace', () => {
    const s = emptyBannerForm('mosaic', { slot: 'lens_type:toric', title: 'resto', cta_href: '/x', image_alt: 'Tóricos' });
    expect(body(s, 'home/t.jpg')).toMatchObject({ slot: 'lens_type:toric', title: '', cta_href: null, image_key: 'home/t.jpg' });
    expect(bannerBody(emptyBannerForm('mosaic'), null)).toBe('Elige la celda del mosaico.');
  });

  it('mosaico de reposición: título y subtítulo, sin imagen', () => {
    const s = emptyBannerForm('mosaic', { slot: 'reorder', title: 'Volver a pedir', subtitle: 'En dos clics', image_alt: 'x' });
    expect(body(s, 'home/x.jpg')).toMatchObject({ title: 'Volver a pedir', subtitle: 'En dos clics', image_key: null, image_alt: null });
    s.subtitle = 'x'.repeat(81);
    expect(bannerBody(s, null)).toBe('El subtítulo admite hasta 80 caracteres aquí.');
  });

  it('promesa: título e ícono, sin imagen ni enlace', () => {
    const s = emptyBannerForm('promise', { title: 'Receta revisada', cta_href: '/x' });
    expect(bannerBody(s, null)).toBe('Elige el ícono de la promesa.');
    s.icon = 'prescription';
    expect(body(s, 'home/x.jpg')).toMatchObject({ icon: 'prescription', image_key: null, cta_href: null });
  });

  it('hero con imagen o con ilustración', () => {
    const s = emptyBannerForm('hero', { title: 'Lentes', cta_label: 'Ver', cta_href: '/lentes', hero_mode: 'art' });
    expect(bannerBody(s, null)).toBe('Elige una ilustración o cambia a imagen.');
    s.art = 'lens';
    expect(body(s, 'home/old.jpg')).toMatchObject({ art: 'lens', image_key: null, image_alt: null });
    expect(bannerBody({ ...s, cta_href: '' }, null)).toBe('Captura el texto y la ruta del enlace.');
    const img = { ...s, hero_mode: 'image' as const, image_alt: 'Foto' };
    expect(body(img, 'home/h.jpg')).toMatchObject({ art: null, image_key: 'home/h.jpg' });
  });

  it('un hero sin imagen se edita en modo ilustración', () => {
    const b = { placement: 'hero', image_key: null, art: 'frame', title: 'T', subtitle: null, cta_label: 'a', cta_href: '/a', image_alt: null, menu: null, slot: null, icon: null, active: true, starts_at: null, ends_at: null } as unknown as AdminHomeBanner;
    expect(bannerFormFrom(b)).toMatchObject({ hero_mode: 'art', art: 'frame' });
  });

  it('reordena dentro de un subgrupo y conserva el lugar de los demás', () => {
    const all = [{ id: 'f1', g: 'f' }, { id: 'c1', g: 'c' }, { id: 'f2', g: 'f' }, { id: 'c2', g: 'c' }];
    expect(reorderWithin(all, (b) => b.g === 'c', 1, -1)).toEqual(['f1', 'c2', 'f2', 'c1']);
    expect(reorderWithin(all, () => true, 0, 1)).toEqual(['c1', 'f1', 'f2', 'c2']);
  });
});
