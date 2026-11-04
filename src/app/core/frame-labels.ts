import { FrameColor, FrameGender, FrameMaterial, FrameRim, FrameShape, ProductCategory } from '../api/generated/model';
import { t } from './i18n';

export const CATEGORY_LABEL: Record<ProductCategory, string> = t('labels.category', { returnObjects: true });

export const SHAPE_LABEL: Record<FrameShape, string> = t('labels.shape', { returnObjects: true });

export const MATERIAL_LABEL: Record<FrameMaterial, string> = t('labels.material', { returnObjects: true });

export const RIM_LABEL: Record<FrameRim, string> = t('labels.rim', { returnObjects: true });

export const GENDER_LABEL: Record<FrameGender, string> = t('labels.gender', { returnObjects: true });

export const COLOR_LABEL: Record<FrameColor, string> = t('labels.color', { returnObjects: true });

/** Convierte un mapa de etiquetas en opciones de un select, en el orden declarado. */
export const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
