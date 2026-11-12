import { ProductCategory } from '../api/generated/model';
import { t } from './i18n';

// Las etiquetas de los atributos de producto (forma, color, tipo de lente…) ya no viven aquí:
// salen del catálogo de la API (core/catalogs.ts, SPEC 16). La categoría sigue siendo un enum fijo.
export const CATEGORY_LABEL: Record<ProductCategory, string> = t('labels.category', { returnObjects: true });

/** Convierte un mapa de etiquetas en opciones de un select, en el orden declarado. */
export const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
