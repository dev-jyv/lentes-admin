import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefaultService } from '../../api/generated/default/default.service';
import type { Catalogs, CatalogValueInput } from '../../api/generated/model';
import { testCatalogs } from '../../core/catalogs.testing';
import Catalogos, { canDelete } from './catalogos';

const conflict = new HttpErrorResponse({ status: 409, error: { detail: 'Lo usan 3 productos: ocúltalo en su lugar' } });

async function setup(catalogs: Catalogs, api: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({
    providers: [{ provide: DefaultService, useValue: { adminListCatalogs: () => of(catalogs), ...api } }],
  });
  const fixture = TestBed.createComponent(Catalogos);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const tab = async (label: string) => {
    [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')].find((b) => b.textContent?.trim() === label)!.click();
    await fixture.whenStable();
  };
  const button = (text: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === text);
  return { fixture, el, tab, button };
}

const type = (el: HTMLElement, id: string, value: string) => {
  const input = el.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

describe('Catálogos', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lista los 9 catálogos', async () => {
    const { el } = await setup(testCatalogs());
    expect(el.querySelectorAll('[role=tab]').length).toBe(9);
  });

  it('no permite crear en tipo de lente ni en reemplazo', async () => {
    const { tab, button } = await setup(testCatalogs());
    expect(button('Nuevo valor')).toBeTruthy();
    await tab('Tipo de lente');
    expect(button('Nuevo valor')).toBeUndefined();
    await tab('Reemplazo');
    expect(button('Nuevo valor')).toBeUndefined();
  });

  it('solo ofrece borrar valores sin uso y que no son de sistema', () => {
    const v = testCatalogs().frame_shape[0];
    expect(canDelete(v)).toBe(true);
    expect(canDelete({ ...v, product_count: 2 })).toBe(false);
    expect(canDelete({ ...v, system: true })).toBe(false);
  });

  it('muestra el 409 de la API al borrar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fixture, el } = await setup(testCatalogs(), { adminDeleteCatalogValue: () => throwError(() => conflict) });
    (el.querySelector('[aria-label="Borrar Rectangular"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Lo usan 3 productos: ocúltalo en su lugar');
  });

  it('un color nuevo exige muestra antes de enviarse', async () => {
    const create = vi.fn((_kind: string, body: CatalogValueInput) => of({ ...body, position: 3, active: true, system: false, product_count: 0 }));
    const { fixture, el, tab, button } = await setup(testCatalogs(), { adminCreateCatalogValue: create });
    await tab('Color');
    button('Nuevo valor')!.click();
    await fixture.whenStable();
    type(el, 'vlabel', 'Verde olivo');
    await fixture.whenStable();
    expect((el.querySelector('#vcode') as HTMLInputElement).value).toBe('verde_olivo');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(create).not.toHaveBeenCalled();
    expect(el.querySelector('form [role=alert]')?.textContent).toContain('muestra de color');

    type(el, 'vswatch', '#556b2f');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(create).toHaveBeenCalledWith('frame_color', { label: 'Verde olivo', code: 'verde_olivo', swatch: '#556b2f' });
    expect(el.querySelector('tbody')?.textContent).toContain('Verde olivo');
  });

  it('oculta un valor con PATCH active=false', async () => {
    const patch = vi.fn((_k: string, code: string, body: { active?: boolean }) =>
      of({ ...testCatalogs().frame_shape.find((v) => v.code === code)!, ...body }));
    const { fixture, el } = await setup(testCatalogs(), { adminUpdateCatalogValue: patch });
    (el.querySelector('[aria-label="Ocultar Ojo de gato"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(patch).toHaveBeenCalledWith('frame_shape', 'cat_eye', { active: false });
    expect(el.querySelector('[aria-label="Mostrar Ojo de gato"]')).toBeTruthy();
  });
});
