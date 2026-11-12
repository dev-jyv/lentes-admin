import { HttpErrorResponse } from '@angular/common/http';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminLensTreatment, LensTreatmentInput } from '../../api/generated/model';
import Micas from './micas';
import LensTreatments from './tratamientos';

const treatment = (id: string, name: string, extra: Partial<AdminLensTreatment> = {}): AdminLensTreatment => ({
  id, name, slug: id, description: null, icon: 'anti_reflective', badge: null, price_cents: 50000,
  vision_types: ['none'], position: 0, active: true, ...extra,
});

async function setup(items: AdminLensTreatment[], api: Record<string, unknown> = {}, component: Type<unknown> = LensTreatments) {
  TestBed.configureTestingModule({
    providers: [{
      provide: DefaultService,
      useValue: { adminListLensTreatments: () => of({ items }), adminListLensPackages: () => of({ items: [] }), ...api },
    }],
  });
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const button = (text: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === text);
  const type = (id: string, value: string) => {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const check = (label: string) => {
    const box = [...el.querySelectorAll('fieldset label')].find((l) => l.textContent?.trim() === label)!.querySelector('input')!;
    box.click();
  };
  const submit = async () => {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, el, button, type, check, submit };
}

describe('Micas', () => {
  it('tiene las pestañas Necesidades visuales y Tratamientos', async () => {
    const { fixture, el } = await setup([treatment('ar', 'Antirreflejante')], {}, Micas);
    const tabs = [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    expect(tabs.map((b) => b.textContent?.trim())).toEqual(['Necesidades visuales', 'Tratamientos']);
    expect(el.textContent).toContain('Aún no hay paquetes de micas.');
    tabs[1].click();
    await fixture.whenStable();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('tbody')?.textContent).toContain('Antirreflejante');
  });
});

describe('Tratamientos', () => {
  it('lista con ícono, necesidades y precio', async () => {
    const { el } = await setup([treatment('ar', 'Antirreflejante', { badge: 'Más vendido', vision_types: ['none', 'progressive'] })]);
    const row = el.querySelector('tbody tr')!.textContent!;
    expect(row).toContain('Más vendido');
    expect(row).toContain('Sin graduación, Visión progresiva');
    expect(row).toContain('$500.00');
  });

  it('ofrece solo tres necesidades y exige al menos una antes de crear', async () => {
    const create = vi.fn((body: LensTreatmentInput) => of({ ...body, id: 'new', position: 1, description: null, badge: body.badge ?? null }));
    const { fixture, el, button, type, check, submit } = await setup([], { adminCreateLensTreatment: create });
    button('Nuevo tratamiento')!.click();
    await fixture.whenStable();
    expect([...el.querySelectorAll('fieldset label')].map((l) => l.textContent?.trim())).toEqual(['Sin graduación', 'Visión sencilla', 'Visión progresiva']);

    type('tname', 'Luz azul');
    type('tprice', '349.90');
    const icon = el.querySelector('#ticon') as HTMLSelectElement;
    icon.value = 'blue_light';
    icon.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect((el.querySelector('#tslug') as HTMLInputElement).value).toBe('luz-azul');
    await submit();
    expect(create).not.toHaveBeenCalled();
    expect(el.querySelector('form [role=alert]')?.textContent).toContain('Elige al menos una necesidad visual.');

    check('Visión progresiva');
    check('Sin graduación');
    await submit();
    expect(create).toHaveBeenCalledWith({
      name: 'Luz azul', slug: 'luz-azul', description: null, icon: 'blue_light', badge: null,
      price_cents: 34990, vision_types: ['none', 'progressive'], active: true,
    });
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('tbody')?.textContent).toContain('Luz azul');
  });

  it('desactiva al editar (no hay borrar) y muestra el error de la API', async () => {
    const update = vi.fn((id: string, body: LensTreatmentInput) => of({ ...treatment(id, body.name), ...body }));
    const { fixture, el, button, submit } = await setup([treatment('ar', 'Antirreflejante')], { adminUpdateLensTreatment: update });
    expect(button('Borrar')).toBeUndefined();
    button('Editar')!.click();
    await fixture.whenStable();
    (el.querySelector('form label > input[type=checkbox]:not([value])') as HTMLInputElement).click();
    await submit();
    expect(update).toHaveBeenCalledWith('ar', expect.objectContaining({ active: false, vision_types: ['none'], price_cents: 50000 }));
    expect(el.querySelector('tbody')?.textContent).toContain('Inactivo');
  });

  it('muestra el 409 de slug repetido', async () => {
    const conflict = new HttpErrorResponse({ status: 409, error: { detail: 'Ya existe un tratamiento con ese slug' } });
    const { fixture, el, button, type, check, submit } = await setup([], { adminCreateLensTreatment: () => throwError(() => conflict) });
    button('Nuevo tratamiento')!.click();
    await fixture.whenStable();
    type('tname', 'Premium');
    type('tprice', '0');
    check('Visión sencilla');
    await submit();
    expect(el.querySelector('form [role=alert]')?.textContent).toContain('Ya existe un tratamiento con ese slug');
  });

  it('reordena enviando el orden completo', async () => {
    const items = [treatment('a', 'Antirreflejante'), treatment('b', 'Luz azul')];
    const reorder = vi.fn(() => of({ items: [items[1], items[0]] }));
    const { fixture, el } = await setup(items, { adminReorderLensTreatments: reorder });
    (el.querySelector('[aria-label="Bajar Antirreflejante"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(reorder).toHaveBeenCalledWith({ treatment_ids: ['b', 'a'] });
    expect(el.querySelector('tbody tr')?.textContent).toContain('Luz azul');
  });
});
