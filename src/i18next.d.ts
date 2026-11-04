import 'i18next';
import type esMX from './i18n/es-MX.json';

// Tipos de las claves: t('clave.inexistente') no compila.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof esMX };
  }
}
