import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminHomeBanner } from '../../api/generated/model';
import { testCatalogs } from '../../core/catalogs.testing';
import HomeContent from './home';

const banner = (id: string, extra: Partial<AdminHomeBanner>): AdminHomeBanner => ({
  id, placement: 'hero', title: '', subtitle: null, cta_label: null, cta_href: null, image_url: null, image_alt: null,
  image_key: null, menu: null, slot: null, icon: null, art: null, position: 0, active: true, starts_at: null, ends_at: null, ...extra,
});

async function setup(items: AdminHomeBanner[] = []) {
  const catalogs = testCatalogs();
  catalogs.lens_type[1] = { ...catalogs.lens_type[1], label: 'Para astigmatismo' };
  TestBed.configureTestingModule({
    providers: [{
      provide: DefaultService,
      useValue: {
        adminListHomeBanners: () => of({ items }),
        adminListHomeFeatured: () => of({ items: [] }),
        adminListCatalogs: () => of(catalogs),
      },
    }],
  });
  const fixture = TestBed.createComponent(HomeContent);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const choose = async (id: string, value: string) => {
    const select = el.querySelector(`#${id}`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { fixture, el, choose };
}

const ids = (el: HTMLElement) => [...el.querySelectorAll('form [id]')].map((n) => n.id);

describe('Home (banners de toda la tienda)', () => {
  it('el formulario pide solo los campos de la ubicación elegida', async () => {
    const { fixture, el, choose } = await setup();
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    await fixture.whenStable();

    await choose('placement', 'menu_card');
    expect(ids(el)).toEqual(expect.arrayContaining(['menu', 'title', 'href', 'img', 'alt']));
    expect(ids(el)).not.toContain('cta');
    expect(ids(el)).not.toContain('subtitle');

    await choose('placement', 'mosaic');
    await choose('slot', 'lens_type:toric');
    expect(ids(el)).toEqual(expect.arrayContaining(['slot', 'img', 'alt']));
    expect(ids(el)).not.toContain('title');
    expect(ids(el)).not.toContain('href');
    // Los tipos de lente se nombran con la etiqueta del catálogo.
    expect(el.querySelector('#slot option[value="lens_type:toric"]')?.textContent).toBe('Para astigmatismo');

    await choose('slot', 'reorder');
    expect(ids(el)).toEqual(expect.arrayContaining(['title', 'subtitle']));
    expect(ids(el)).not.toContain('img');
  });

  it('las promesas eligen ícono con vista previa y avisan junto a "entrega"', async () => {
    const { fixture, el, choose } = await setup();
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    await choose('placement', 'promise');
    const radios = el.querySelectorAll<HTMLInputElement>('fieldset input[type=radio]');
    expect(radios.length).toBe(6);
    expect(el.querySelectorAll('fieldset app-promise-icon svg').length).toBe(6);
    expect(el.textContent).not.toContain('promesas de entrega que la tienda cumple');
    const delivery = [...radios].find((r) => r.value === 'delivery')!;
    delivery.click();
    await fixture.whenStable();
    expect(el.querySelector('#icon-warning')?.textContent).toContain('Usa este ícono solo con promesas de entrega que la tienda cumple');
  });

  it('el hero elige entre imagen e ilustración', async () => {
    const { fixture, el, choose } = await setup();
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    await choose('placement', 'hero');
    expect(ids(el)).toContain('img');
    const art = [...el.querySelectorAll<HTMLInputElement>('input[type=radio]')].find((r) => r.value === 'art')!;
    art.click();
    await fixture.whenStable();
    expect(ids(el)).toContain('art');
    expect(ids(el)).not.toContain('img');
  });

  it('el mosaico muestra los 7 slots con su foto vigente o el aviso del bloque de color', async () => {
    const { el } = await setup([
      banner('t', { placement: 'mosaic', slot: 'lens_type:toric', image_url: 'https://cdn.test/t.jpg', image_alt: 'Tóricos' }),
      banner('f', { placement: 'mosaic', slot: 'frames', image_url: 'https://cdn.test/f.jpg', image_alt: 'Armazones', active: false }),
    ]);
    const grid = el.querySelector('app-mosaic-grid') as HTMLElement;
    expect(grid.querySelectorAll('button').length).toBe(7);
    expect(grid.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/t.jpg');
    // 5 celdas de foto sin banner vigente (el de armazones está inactivo); la de reposición no lleva foto.
    expect(grid.textContent?.match(/Sin foto: se muestra un bloque de color/g)?.length).toBe(5);
    expect(grid.querySelector('[aria-label="Cambiar foto de Para astigmatismo"]')).toBeTruthy();
  });

  it('marca hasta 4 tarjetas vigentes por menú como "se muestra"', async () => {
    const cards = [0, 1, 2, 3, 4].map((i) =>
      banner(`c${i}`, { placement: 'menu_card', menu: 'contact_lens', title: `Tarjeta ${i}`, position: i, cta_href: '/lentes', image_url: 'https://cdn.test/c.png' }));
    const { el } = await setup(cards);
    const section = el.querySelector('[aria-labelledby="g-menu_card"]') as HTMLElement;
    expect(section.textContent?.match(/se muestra/g)?.length).toBe(4);
  });
});
