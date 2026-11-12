import { inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../api/generated/default/default.service';
import { CatalogKind } from '../api/generated/model';
import type { CatalogValue, CatalogValueInput, CatalogValuePatch, Catalogs } from '../api/generated/model';
import { t } from './i18n';
import { problemMessage } from './problem';

// Catálogos de atributos (SPEC 16): etiquetas, orden y visibilidad salen de la API, no del i18n del panel.

/** Los 9 catálogos, en el orden del contrato. */
export const CATALOG_KINDS = Object.values(CatalogKind);

/** Tipo de lente y reemplazo tienen valores fijos: el código depende de ellos (tórico exige cilindro y eje). */
export const isFixedCatalog = (kind: CatalogKind): boolean =>
  kind === CatalogKind.lens_type || kind === CatalogKind.replacement;

/** Mismo patrón que la API para el código de un valor. */
export const CATALOG_CODE_RE = /^[a-z][a-z0-9_]{1,39}$/;
export const MAX_CATALOG_LABEL = 40;

/** "cat_eye" -> "Cat eye". Respaldo cuando no hay etiqueta (catálogo sin cargar o valor desconocido). */
export function readableCode(code: string): string {
  const s = code.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const byPosition = (values: readonly CatalogValue[]) => [...values].sort((a, b) => a.position - b.position);

/** Etiqueta de un código; si no está en el catálogo, su código legible. */
export function catalogLabel(values: readonly CatalogValue[] | undefined, code: string | null | undefined): string {
  if (!code) return '—';
  return values?.find((v) => v.code === code)?.label ?? readableCode(code);
}

export interface CatalogOption {
  value: string;
  label: string;
  hidden: boolean;
  swatch?: string;
}

/**
 * Opciones de un formulario: los valores visibles en su orden y, además, los ocultos que el producto ya tiene,
 * marcados "(oculto)" para poder conservarlos. Un valor oculto no se ofrece para asignaciones nuevas.
 */
export function catalogOptions(
  values: readonly CatalogValue[] | undefined,
  keep: string | readonly string[] | null | undefined = null,
): CatalogOption[] {
  const kept = new Set(keep == null ? [] : typeof keep === 'string' ? [keep] : keep);
  return byPosition(values ?? [])
    .filter((v) => v.active || kept.has(v.code))
    .map((v) => ({
      value: v.code,
      label: v.active ? v.label : t('catalogos.hiddenOption', { label: v.label }),
      hidden: !v.active,
      ...(v.swatch ? { swatch: v.swatch } : {}),
    }));
}

/** Valor por omisión de un formulario nuevo: `preferred` si está visible; si no, el primero visible. */
export function defaultCode(values: readonly CatalogValue[] | undefined, preferred = ''): string {
  if (!values) return preferred;
  const visible = byPosition(values).filter((v) => v.active);
  return visible.some((v) => v.code === preferred) ? preferred : (visible[0]?.code ?? '');
}

const ACCENTS: Record<string, string> = { á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ñ: 'n', ç: 'c' };

/** Igual que la API: minúsculas, sin acentos, espacios y guiones a `_`, sin otros símbolos y hasta 40 caracteres. */
export function catalogCode(label: string): string {
  let out = '';
  for (const ch of label.trim().toLowerCase()) {
    const c = ACCENTS[ch] ?? ch;
    if (/[a-z0-9]/.test(c)) out += c;
    else if (' _-/.'.includes(c)) out += '_';
  }
  const code = out.split('_').filter(Boolean).join('_');
  return code.length > 40 ? code.slice(0, 40).replace(/_+$/, '') : code;
}

const HEX_RE = /^#[0-9a-f]{6}$/;
const GRADIENT_RE = /^conic-gradient\((#[0-9a-f]{6}(?:,#[0-9a-f]{6}){1,11})\)$/;

/** Igual que la API: `#rrggbb` o `conic-gradient(#rrggbb, ...)` de 2 a 12 colores. Devuelve la forma canónica o null. */
export function normalizeSwatch(swatch: string): string | null {
  const s = swatch.replace(/\s+/g, '').toLowerCase();
  if (HEX_RE.test(s)) return s;
  const m = GRADIENT_RE.exec(s);
  return m ? `conic-gradient(${m[1].replace(/,/g, ', ')})` : null;
}

export interface CatalogValueForm {
  label: string;
  code: string;
  swatch: string;
}

/** Cuerpo para crear un valor, o un texto de error. Valida lo mismo que la API para avisar antes de enviar. */
export function catalogValueInput(kind: CatalogKind, s: CatalogValueForm): CatalogValueInput | string {
  if (isFixedCatalog(kind)) return t('catalogos.errors.fixed');
  const label = s.label.trim();
  if (!label || label.length > MAX_CATALOG_LABEL) return t('catalogos.errors.label', { max: MAX_CATALOG_LABEL });
  const code = s.code.trim() || catalogCode(label);
  if (!CATALOG_CODE_RE.test(code)) return t('catalogos.errors.code');
  if (kind !== CatalogKind.frame_color) return { label, code };
  if (!s.swatch.trim()) return t('catalogos.errors.swatchRequired');
  const swatch = normalizeSwatch(s.swatch);
  return swatch ? { label, code, swatch } : t('catalogos.errors.swatchInvalid');
}

/** Cambios de etiqueta y, en color, de muestra. El código no cambia después de creado. */
export function catalogValuePatch(kind: CatalogKind, s: CatalogValueForm): CatalogValuePatch | string {
  const label = s.label.trim();
  if (!label || label.length > MAX_CATALOG_LABEL) return t('catalogos.errors.label', { max: MAX_CATALOG_LABEL });
  if (kind !== CatalogKind.frame_color || !s.swatch.trim()) return { label };
  const swatch = normalizeSwatch(s.swatch);
  return swatch ? { label, swatch } : t('catalogos.errors.swatchInvalid');
}

/** Catálogos de la sesión de admin: se piden una vez y la pantalla Catálogos los mantiene al día. */
@Service()
export class CatalogStore {
  private readonly api = inject(DefaultService);
  private pending: Promise<Catalogs | null> | null = null;

  readonly catalogs = signal<Catalogs | null>(null);
  readonly error = signal<string | null>(null);

  /** Sin `force`, reutiliza lo ya cargado (o la petición en curso). */
  load(force = false): Promise<Catalogs | null> {
    const loaded = this.catalogs();
    if (loaded && !force) return Promise.resolve(loaded);
    if (this.pending && !force) return this.pending;
    const request = firstValueFrom(this.api.adminListCatalogs())
      .then((c) => {
        this.catalogs.set(c);
        this.error.set(null);
        return c;
      })
      .catch((e: unknown) => {
        this.error.set(problemMessage(e, t('catalogos.loadFailed')));
        return null;
      })
      .finally(() => {
        if (this.pending === request) this.pending = null;
      });
    this.pending = request;
    return request;
  }

  values(kind: CatalogKind): CatalogValue[] {
    return byPosition(this.catalogs()?.[kind] ?? []);
  }

  label(kind: CatalogKind, code: string | null | undefined): string {
    return catalogLabel(this.catalogs()?.[kind], code);
  }

  swatch(kind: CatalogKind, code: string | null | undefined): string | null {
    return this.catalogs()?.[kind].find((v) => v.code === code)?.swatch ?? null;
  }

  options(kind: CatalogKind, keep?: string | readonly string[] | null): CatalogOption[] {
    return catalogOptions(this.catalogs()?.[kind], keep);
  }

  /** Reemplaza un catálogo completo (tras reordenar). */
  setKind(kind: CatalogKind, values: CatalogValue[]) {
    this.catalogs.update((c) => (c ? { ...c, [kind]: byPosition(values) } : c));
  }

  /** Agrega o reemplaza un valor (tras crear o editar). */
  upsert(kind: CatalogKind, value: CatalogValue) {
    this.catalogs.update((c) => {
      if (!c) return c;
      const list = c[kind];
      const next = list.some((v) => v.code === value.code)
        ? list.map((v) => (v.code === value.code ? value : v))
        : [...list, value];
      return { ...c, [kind]: byPosition(next) };
    });
  }

  remove(kind: CatalogKind, code: string) {
    this.catalogs.update((c) => (c ? { ...c, [kind]: c[kind].filter((v) => v.code !== code) } : c));
  }
}
