import { FrameColor, FrameGender, FrameMaterial, FrameRim, FrameShape, ProductCategory } from '../api/generated/model';

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  contact_lens: 'Lente de contacto',
  frame: 'Armazón',
};

export const SHAPE_LABEL: Record<FrameShape, string> = {
  rectangular: 'Rectangular',
  square: 'Cuadrado',
  round: 'Redondo',
  oval: 'Ovalado',
  cat_eye: 'Ojo de gato',
  aviator: 'Aviador',
  browline: 'Browline',
  geometric: 'Geométrico',
};

export const MATERIAL_LABEL: Record<FrameMaterial, string> = {
  acetate: 'Acetato',
  metal: 'Metal',
  titanium: 'Titanio',
  tr90: 'TR90',
  mixed: 'Mixto',
};

export const RIM_LABEL: Record<FrameRim, string> = {
  full: 'Completo',
  semi: 'Semi al aire',
  rimless: 'Al aire',
};

export const GENDER_LABEL: Record<FrameGender, string> = {
  women: 'Mujer',
  men: 'Hombre',
  unisex: 'Unisex',
  kids: 'Niños',
};

export const COLOR_LABEL: Record<FrameColor, string> = {
  black: 'Negro',
  tortoise: 'Carey',
  brown: 'Café',
  transparent: 'Transparente',
  gray: 'Gris',
  blue: 'Azul',
  green: 'Verde',
  red: 'Rojo',
  pink: 'Rosa',
  purple: 'Morado',
  gold: 'Dorado',
  silver: 'Plateado',
  multicolor: 'Multicolor',
};

/** Convierte un mapa de etiquetas en opciones de un select, en el orden declarado. */
export const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
