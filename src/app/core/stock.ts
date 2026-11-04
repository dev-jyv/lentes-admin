import type { ManualStockReason, StockReason } from '../api/generated/model';
import { t } from './i18n';

export const REASON_LABEL: Record<StockReason, string> = t('labels.stockReason', { returnObjects: true });

/** Motivos que el admin puede elegir en un ajuste; el resto los registra el sistema. */
export const MANUAL_REASONS: ManualStockReason[] = ['receipt', 'count_correction', 'damage', 'return', 'other'];

/** Mensaje de error para un ajuste de existencia, o null si es válido. La API vuelve a validar. */
export function validateAdjustment(
  delta: number | null,
  reason: ManualStockReason,
  note: string,
  currentStock: number,
): string | null {
  if (delta === null || !Number.isInteger(delta)) return t('stock.integerRequired');
  if (delta === 0) return t('stock.zero');
  if (currentStock + delta < 0) return t('stock.negative', { stock: currentStock });
  if (reason === 'other' && !note.trim()) return t('stock.noteRequired');
  return null;
}
