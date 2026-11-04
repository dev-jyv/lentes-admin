import { HttpErrorResponse } from '@angular/common/http';
import { t } from './i18n';

interface ProblemBody {
  title?: string;
  detail?: string;
  errors?: { row: number; message: string }[];
}

/** Mensaje legible a partir de un error RFC 9457 (application/problem+json). */
export function problemMessage(err: unknown, fallback = t('errors.generic')): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) return t('errors.network');
  if (err.status === 401) return t('errors.sessionExpired');
  if (err.status === 403) return t('errors.forbidden');
  const body = err.error as ProblemBody | null;
  return body?.detail ?? body?.title ?? fallback;
}

export function importErrors(err: unknown): { row: number; message: string }[] {
  return err instanceof HttpErrorResponse ? ((err.error as ProblemBody | null)?.errors ?? []) : [];
}
