import type { CatalogValue, Catalogs } from '../api/generated/model';

// Catálogo de ejemplo para las pruebas: los valores precargados por la migración de SPEC 16, en su orden.

const values = (codes: [string, string][], extra: Partial<CatalogValue> = {}): CatalogValue[] =>
  codes.map(([code, label], position) => ({ code, label, position, active: true, system: false, product_count: 0, ...extra }));

export const testCatalogs = (): Catalogs => ({
  lens_type: values([['spherical', 'Esférico'], ['toric', 'Tórico'], ['multifocal', 'Multifocal'], ['cosmetic', 'Cosmético']], { system: true }),
  replacement: values([['daily', 'Diario'], ['biweekly', 'Quincenal'], ['monthly', 'Mensual'], ['quarterly', 'Trimestral'], ['yearly', 'Anual']], { system: true }),
  frame_shape: values([['rectangular', 'Rectangular'], ['square', 'Cuadrado'], ['round', 'Redondo'], ['oval', 'Ovalado'], ['cat_eye', 'Ojo de gato']]),
  frame_material: values([['acetate', 'Acetato'], ['metal', 'Metal'], ['titanium', 'Titanio']]),
  frame_rim: values([['full', 'Completo'], ['semi', 'Semi al aire'], ['rimless', 'Al aire']]),
  frame_gender: values([['women', 'Mujer'], ['men', 'Hombre'], ['unisex', 'Unisex'], ['kids', 'Niños']]),
  frame_color: values([['black', 'Negro'], ['tortoise', 'Carey'], ['gold', 'Dorado']]).map((v, i) => ({
    ...v, swatch: ['#1a1a1a', '#6b3f1d', '#c9a227'][i],
  })),
  frame_size: values([['small', 'Chica'], ['medium', 'Mediana'], ['large', 'Grande']]),
  frame_include: [
    ...values([['case', 'Estuche'], ['cleaning_cloth', 'Paño de limpieza'], ['scratch_resistant', 'Capa antirrayas']]),
    { code: 'warranty', label: 'Garantía', position: 3, active: true, system: true, product_count: 0 },
    ...values([['blue_light_filter', 'Filtro de luz azul'], ['anti_reflective', 'Antirreflejante']]).map((v) => ({ ...v, position: v.position + 4 })),
    { code: 'optician_fitting', label: 'Ajuste en óptica', position: 6, active: true, system: true, product_count: 0 },
  ],
});

/** Copia del catálogo con un valor oculto. */
export const withHidden = (c: Catalogs, kind: keyof Catalogs, code: string): Catalogs => ({
  ...c,
  [kind]: c[kind].map((v) => (v.code === code ? { ...v, active: false } : v)),
});
