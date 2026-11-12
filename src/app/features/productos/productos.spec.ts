import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DefaultService } from '../../api/generated/default/default.service';
import { ProductCategory } from '../../api/generated/model';
import type { AdminProduct, Catalogs } from '../../api/generated/model';
import { testCatalogs, withHidden } from '../../core/catalogs.testing';
import Productos from './productos';

const lux = {
  id: 'p1', category: ProductCategory.frame, brand: { id: 'b1', name: 'B', slug: 'b' }, name: 'Lux', slug: 'lux',
  description: null, lens_type: null, replacement: null, pieces_per_box: null, material: null, water_content_pct: null,
  manufacturer: null, uv_blocking: null, visibility_tint: null, package_note: null, requires_prescription: false, active: true,
  frame: {
    shape: 'cat_eye', material: 'metal', rim: 'full', gender: 'women', lens_width_mm: 50, bridge_mm: 18, temple_mm: 140,
    lens_height_mm: null, frame_width_mm: null, weight_g: null, size: null, spring_hinges: null, adjustable_nose_pads: null,
    progressive_eligible: null, includes: [], warranty_months: null,
  },
} as unknown as AdminProduct;

async function setup(catalogs: Catalogs, products: AdminProduct[] = []) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: DefaultService,
        useValue: {
          listBrands: () => of({ items: [] }),
          adminListProducts: () => of({ items: products, next_cursor: null }),
          adminListCatalogs: () => of(catalogs),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Productos);
  // ngOnInit encadena varias promesas (marcas, catálogo y productos): se espera a que todo se pinte.
  await fixture.whenStable();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const optionTexts = (el: HTMLElement, id: string) =>
  [...el.querySelectorAll<HTMLOptionElement>(`#${id} option`)].map((o) => o.textContent?.trim());

describe('Productos (formulario de armazón)', () => {
  it('meses de garantía se habilitan al marcar "Garantía" y se muestra apto para progresivos', async () => {
    const { fixture, el } = await setup(testCatalogs());
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    const category = el.querySelector('#category') as HTMLSelectElement;
    category.value = 'frame';
    category.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const warranty = el.querySelector('#warranty') as HTMLInputElement;
    expect(warranty.disabled).toBe(true);
    const boxes = el.querySelectorAll<HTMLInputElement>('fieldset input[type=checkbox]');
    expect(boxes.length).toBe(7);
    boxes[3].click(); // garantía, en el orden del catálogo
    await fixture.whenStable();
    expect(warranty.disabled).toBe(false);

    const height = el.querySelector('#lheight') as HTMLInputElement;
    height.value = '28';
    height.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('#progressive')?.textContent).toContain('Sí');
  });

  it('las opciones salen del catálogo: un valor oculto no se ofrece al crear', async () => {
    const { fixture, el } = await setup(withHidden(testCatalogs(), 'frame_shape', 'cat_eye'));
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    const category = el.querySelector('#category') as HTMLSelectElement;
    category.value = 'frame';
    category.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(optionTexts(el, 'shape')).toEqual(['Rectangular', 'Cuadrado', 'Redondo', 'Ovalado']);
  });

  it('al editar un armazón con un valor oculto, lo muestra como "(oculto)" y lo conserva', async () => {
    const { fixture, el } = await setup(withHidden(testCatalogs(), 'frame_shape', 'cat_eye'), [lux]);
    const edit = [...el.querySelectorAll<HTMLButtonElement>('button.link')].find((b) => b.textContent?.includes('Editar'))!;
    edit.click();
    await fixture.whenStable();
    expect(optionTexts(el, 'shape')).toContain('Ojo de gato (oculto)');
    expect((el.querySelector('#shape') as HTMLSelectElement).value).toBe('cat_eye');
    // La tabla muestra la etiqueta del catálogo aunque el valor esté oculto.
    expect(el.querySelector('tbody')?.textContent).toContain('Ojo de gato');
  });
});
