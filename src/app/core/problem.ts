import { HttpErrorResponse } from '@angular/common/http';

interface ProblemBody {
  title?: string;
  detail?: string;
  errors?: { row: number; message: string }[];
}

/** Mensaje legible a partir de un error RFC 9457 (application/problem+json). */
export function problemMessage(err: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.'): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) return 'No se pudo conectar con la API.';
  if (err.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (err.status === 403) return 'No tienes permisos de administrador.';
  const body = err.error as ProblemBody | null;
  return body?.detail ?? body?.title ?? fallback;
}

export function importErrors(err: unknown): { row: number; message: string }[] {
  return err instanceof HttpErrorResponse ? ((err.error as ProblemBody | null)?.errors ?? []) : [];
}
