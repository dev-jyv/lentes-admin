import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { importErrors, problemMessage } from './problem';

describe('problem', () => {
  it('prefiere detail de problem+json', () => {
    const err = new HttpErrorResponse({ status: 409, error: { title: 'Conflicto', detail: 'slug repetido' } });
    expect(problemMessage(err)).toBe('slug repetido');
  });

  it('mensajes por código especial', () => {
    expect(problemMessage(new HttpErrorResponse({ status: 0 }))).toContain('conectar');
    expect(problemMessage(new HttpErrorResponse({ status: 403 }))).toContain('administrador');
  });

  it('extrae errores por fila del import', () => {
    const err = new HttpErrorResponse({ status: 400, error: { errors: [{ row: 3, message: 'sku vacío' }] } });
    expect(importErrors(err)).toEqual([{ row: 3, message: 'sku vacío' }]);
    expect(importErrors(new Error('x'))).toEqual([]);
  });
});
