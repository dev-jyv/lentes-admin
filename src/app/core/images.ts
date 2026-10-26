export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImage(file: { type: string; size: number; name: string }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return `${file.name}: usa JPG, PNG o WebP.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: pesa más de 5 MB.`;
  return null;
}

/** Mueve el elemento `index` una posición (dir -1 arriba, +1 abajo). Devuelve el mismo arreglo si no se puede. */
export function move<T>(list: readonly T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
