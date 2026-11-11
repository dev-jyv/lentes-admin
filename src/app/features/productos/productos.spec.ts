import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DefaultService } from '../../api/generated/default/default.service';
import Productos from './productos';

describe('Productos (formulario de armazón)', () => {
  it('meses de garantía se habilitan al marcar "Garantía" y se muestra apto para progresivos', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DefaultService, useValue: { listBrands: () => of({ items: [] }), adminListProducts: () => of({ items: [], next_cursor: null }) } },
      ],
    });
    const fixture = TestBed.createComponent(Productos);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
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
    boxes[3].click(); // garantía, en el orden del enum
    await fixture.whenStable();
    expect(warranty.disabled).toBe(false);

    const height = el.querySelector('#lheight') as HTMLInputElement;
    height.value = '28';
    height.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('#progressive')?.textContent).toContain('Sí');
  });
});
