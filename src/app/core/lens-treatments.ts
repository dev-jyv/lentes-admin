import { TreatmentIcon, VisionType } from '../api/generated/model';
import type { AdminLensTreatment, LensTreatmentInput } from '../api/generated/model';
import { centsToPesos, pesosToCents } from './money';
import { t } from './i18n';

// Límites de lentes-api (SPEC 17): el panel valida lo mismo antes de enviar.
export const MAX_TREATMENT_NAME = 60;
export const MAX_TREATMENT_DESCRIPTION = 160;
export const MAX_BADGE = 24;

export const VISION_LABEL: Record<VisionType, string> = t('labels.vision', { returnObjects: true });
export const TREATMENT_ICON_LABEL: Record<TreatmentIcon, string> = t('labels.treatmentIcon', { returnObjects: true });

/** Necesidades a las que puede aplicar un tratamiento: "Solo armazón" nunca lleva micas ni tratamiento. */
export const TREATMENT_VISIONS: readonly VisionType[] = [VisionType.none, VisionType.single_vision, VisionType.progressive];

export interface TreatmentForm {
  name: string;
  slug: string;
  description: string;
  icon: TreatmentIcon;
  badge: string;
  price_pesos: number | null;
  vision_types: VisionType[];
  active: boolean;
}

export const emptyTreatmentForm = (): TreatmentForm => ({
  name: '', slug: '', description: '', icon: TreatmentIcon.anti_reflective, badge: '', price_pesos: null,
  vision_types: [], active: true,
});

export const treatmentFormFrom = (tr: AdminLensTreatment): TreatmentForm => ({
  name: tr.name, slug: tr.slug, description: tr.description ?? '', icon: tr.icon, badge: tr.badge ?? '',
  price_pesos: centsToPesos(tr.price_cents), vision_types: tr.vision_types.filter((v) => TREATMENT_VISIONS.includes(v)), active: tr.active,
});

/** Marca o desmarca una necesidad conservando el orden de TREATMENT_VISIONS. */
export const toggleVision = (list: readonly VisionType[], v: VisionType, on: boolean): VisionType[] =>
  TREATMENT_VISIONS.filter((x) => (x === v ? on : list.includes(x)));

/** Cuerpo para la API, o el mensaje del primer error. */
export function treatmentInput(s: TreatmentForm): LensTreatmentInput | string {
  const name = s.name.trim();
  const slug = s.slug.trim();
  if (!name || !slug || s.price_pesos == null || s.price_pesos < 0) return t('common.checkRequired');
  const description = s.description.trim();
  const badge = s.badge.trim();
  if (name.length > MAX_TREATMENT_NAME || description.length > MAX_TREATMENT_DESCRIPTION || badge.length > MAX_BADGE) {
    return t('common.checkLength');
  }
  const vision_types = TREATMENT_VISIONS.filter((v) => s.vision_types.includes(v));
  if (!vision_types.length) return t('tratamientos.visionTypesRequired');
  return {
    name, slug, description: description || null, icon: s.icon, badge: badge || null,
    price_cents: pesosToCents(s.price_pesos), vision_types, active: s.active,
  };
}
