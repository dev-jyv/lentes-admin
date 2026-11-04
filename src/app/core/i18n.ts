import { Pipe, PipeTransform } from '@angular/core';
import { createInstance, type ParseKeys, type TOptions } from 'i18next';
import esMX from '../../i18n/es-MX.json';

// Todos los textos fijos del panel viven en src/i18n/es-MX.json; en plantillas se usan con el pipe `t`.
const i18n = createInstance();

void i18n.init({
  lng: 'es-MX',
  fallbackLng: false,
  initAsync: false,
  resources: { 'es-MX': { translation: esMX } },
  // Angular ya escapa lo que pinta; escapar aquí duplicaría entidades como &amp;.
  interpolation: { escapeValue: false, defaultVariables: { brand: esMX.brand.name } },
});

export const t = i18n.t.bind(i18n);

@Pipe({ name: 't' })
export class TPipe implements PipeTransform {
  transform(key: ParseKeys, options?: TOptions): string {
    return t(key, options as TOptions & { returnObjects?: false }) as string;
  }
}
