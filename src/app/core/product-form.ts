import { disabled, required, type SchemaFn } from '@angular/forms/signals';
import { LensType, ProductCategory, Replacement } from '../api/generated/model';
import type { AdminProduct, CatalogValue, Catalogs, ProductInput } from '../api/generated/model';
import { defaultCode } from './catalogs';
import { t } from './i18n';

/** Booleano opcional en un select: '' es "Sin dato" (`null` en la API). */
export type Tri = '' | 'yes' | 'no';
export const toTri = (v: boolean | null | undefined): Tri => (v == null ? '' : v ? 'yes' : 'no');
export const fromTri = (v: Tri): boolean | null => (v === '' ? null : v === 'yes');

/** Igual que lentes-api: apto para progresivos con alto de mica >= 28 mm; sin alto, `null`. */
export const PROGRESSIVE_MIN_LENS_HEIGHT_MM = 28;
export const progressiveEligible = (lensHeightMm: number | null): boolean | null =>
  lensHeightMm == null ? null : lensHeightMm >= PROGRESSIVE_MIN_LENS_HEIGHT_MM;

/** Código de "qué incluye" que habilita los meses de garantía; es de sistema, así que siempre existe. */
export const WARRANTY = 'warranty';

/** Una casilla por valor del catálogo "qué incluye", en su orden; `warranty` siempre está porque rige otro campo. */
const noIncludes = (values: readonly CatalogValue[] = []): Record<string, boolean> => {
  const codes = values.map((v) => v.code);
  if (!codes.includes(WARRANTY)) codes.push(WARRANTY);
  return Object.fromEntries(codes.map((c) => [c, false]));
};

export interface ProductForm {
  category: ProductCategory;
  // Códigos de catálogo (SPEC 16): texto libre validado por la API contra `catalog_values`.
  shape: string;
  frame_material: string;
  rim: string;
  gender: string;
  lens_width_mm: number | null;
  bridge_mm: number | null;
  temple_mm: number | null;
  lens_height_mm: number | null;
  frame_width_mm: number | null;
  weight_g: number | null;
  size: string;
  spring_hinges: Tri;
  adjustable_nose_pads: Tri;
  includes: Record<string, boolean>;
  warranty_months: number | null;
  brand_id: string;
  name: string;
  slug: string;
  description: string;
  lens_type: string;
  replacement: string;
  pieces_per_box: number;
  material: string;
  water_content_pct: number | null;
  manufacturer: string;
  uv_blocking: Tri;
  visibility_tint: Tri;
  package_note: string;
  requires_prescription: boolean;
  active: boolean;
}

/**
 * Formulario vacío. Con el catálogo cargado, cada atributo empieza en su valor habitual si está visible
 * (o en el primero visible); un valor oculto nunca se propone para un producto nuevo.
 */
export const emptyProductForm = (c: Catalogs | null = null): ProductForm => ({
  category: ProductCategory.contact_lens,
  shape: defaultCode(c?.frame_shape, 'rectangular'), frame_material: defaultCode(c?.frame_material, 'acetate'),
  rim: defaultCode(c?.frame_rim, 'full'), gender: defaultCode(c?.frame_gender, 'unisex'),
  lens_width_mm: null, bridge_mm: null, temple_mm: null,
  lens_height_mm: null, frame_width_mm: null, weight_g: null, size: '',
  spring_hinges: '', adjustable_nose_pads: '', includes: noIncludes(c?.frame_include), warranty_months: null,
  brand_id: '', name: '', slug: '', description: '', lens_type: defaultCode(c?.lens_type, LensType.spherical),
  replacement: defaultCode(c?.replacement, Replacement.monthly), pieces_per_box: 6, material: '', water_content_pct: null,
  manufacturer: '', uv_blocking: '', visibility_tint: '', package_note: '',
  requires_prescription: true, active: true,
});

/** Formulario de un producto existente: conserva sus valores aunque estén ocultos en el catálogo. */
export const productFormFrom = (p: AdminProduct, c: Catalogs | null = null): ProductForm => {
  const f = p.frame;
  return {
    ...emptyProductForm(c),
    category: p.category,
    ...(f
      ? {
          shape: f.shape, frame_material: f.material, rim: f.rim, gender: f.gender,
          lens_width_mm: f.lens_width_mm, bridge_mm: f.bridge_mm, temple_mm: f.temple_mm,
          lens_height_mm: f.lens_height_mm ?? null, frame_width_mm: f.frame_width_mm ?? null,
          weight_g: f.weight_g ?? null, size: f.size ?? '',
          spring_hinges: toTri(f.spring_hinges), adjustable_nose_pads: toTri(f.adjustable_nose_pads),
          includes: { ...noIncludes(c?.frame_include), ...Object.fromEntries((f.includes ?? []).map((v) => [v, true])) },
          warranty_months: f.warranty_months ?? null,
        }
      : {}),
    brand_id: p.brand.id, name: p.name, slug: p.slug, description: p.description ?? '',
    lens_type: p.lens_type ?? LensType.spherical, replacement: p.replacement ?? Replacement.monthly,
    pieces_per_box: p.pieces_per_box ?? 6,
    material: p.material ?? '', water_content_pct: p.water_content_pct ?? null,
    manufacturer: p.manufacturer ?? '', uv_blocking: toTri(p.uv_blocking), visibility_tint: toTri(p.visibility_tint),
    package_note: p.package_note ?? '',
    requires_prescription: p.requires_prescription, active: p.active,
  };
};

/** Reglas del formulario; `locked` bloquea la categoría al editar. */
export const productFormSchema = (locked: () => boolean): SchemaFn<ProductForm> => (f) => {
  required(f.brand_id);
  required(f.name);
  required(f.slug);
  disabled(f.category, locked);
  disabled(f.warranty_months, ({ valueOf }) => !valueOf(f.includes)[WARRANTY]);
};

/**
 * Cuerpo completo para crear o editar. La API reemplaza el producto entero en cada guardado,
 * así que siempre se envían todos los campos de la categoría (vacíos como `null`) para no borrar datos.
 * Devuelve un texto de error si falta algo que la API exige.
 */
export function productBody(s: ProductForm): ProductInput | string {
  const common = {
    category: s.category, brand_id: s.brand_id, name: s.name.trim(), slug: s.slug.trim(),
    description: s.description.trim() || null, active: s.active,
  };
  if (s.category === ProductCategory.frame) {
    if (s.lens_width_mm == null || s.bridge_mm == null || s.temple_mm == null) return t('productos.measuresRequired');
    const includes = Object.keys(s.includes).filter((v) => s.includes[v]);
    return {
      ...common, requires_prescription: false,
      frame: {
        shape: s.shape, material: s.frame_material, rim: s.rim, gender: s.gender,
        lens_width_mm: s.lens_width_mm, bridge_mm: s.bridge_mm, temple_mm: s.temple_mm,
        lens_height_mm: s.lens_height_mm, frame_width_mm: s.frame_width_mm, weight_g: s.weight_g,
        size: s.size || null,
        spring_hinges: fromTri(s.spring_hinges), adjustable_nose_pads: fromTri(s.adjustable_nose_pads),
        includes,
        // Sin "garantía" el campo está deshabilitado; la API rechaza meses sin ella.
        warranty_months: s.includes[WARRANTY] ? s.warranty_months : null,
      },
    };
  }
  if (s.pieces_per_box < 1) return t('productos.piecesMin');
  return {
    ...common,
    lens_type: s.lens_type as ProductInput['lens_type'],
    replacement: s.replacement as ProductInput['replacement'],
    pieces_per_box: s.pieces_per_box, material: s.material.trim() || null,
    water_content_pct: s.water_content_pct,
    manufacturer: s.manufacturer.trim() || null,
    uv_blocking: fromTri(s.uv_blocking), visibility_tint: fromTri(s.visibility_tint),
    package_note: s.package_note.trim() || null,
    requires_prescription: s.requires_prescription,
  };
}
