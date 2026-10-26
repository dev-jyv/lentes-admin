import type { StockReason } from '../api/generated/model';

export const REASON_LABEL: Record<StockReason, string> = {
  receipt: 'Recepción de mercancía',
  count_correction: 'Corrección por conteo',
  damage: 'Merma o daño',
  return: 'Devolución',
  other: 'Otro (explicar en la nota)',
};

/** Mensaje de error para un ajuste de existencia, o null si es válido. La API vuelve a validar. */
export function validateAdjustment(
  delta: number | null,
  reason: StockReason,
  note: string,
  currentStock: number,
): string | null {
  if (delta === null || !Number.isInteger(delta)) return 'Captura una cantidad entera.';
  if (delta === 0) return 'El ajuste no puede ser 0.';
  if (currentStock + delta < 0) return `La existencia no puede quedar negativa (hay ${currentStock}).`;
  if (reason === 'other' && !note.trim()) return 'Explica el motivo en la nota.';
  return null;
}
