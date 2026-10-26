/** Porcentaje a/b con un decimal, o null si no hay base (evita mostrar 0% o NaN engañosos). */
export function pct(part: number, total: number): string | null {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Rango [hoy - (days-1), hoy] en YYYY-MM-DD. */
export function lastDays(days: number, today = new Date()): { from: string; to: string } {
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: ymd(from), to: ymd(today) };
}
