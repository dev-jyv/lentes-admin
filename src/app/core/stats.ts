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

/** Un punto por día de [from, to]; los días sin ventas (la API los omite) quedan en cero. */
export function fillDays<T extends { date: string; revenue_cents: number; orders: number }>(
  daily: T[],
  from: string,
  to: string,
): { date: string; revenue_cents: number; orders: number }[] {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); ymd(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = ymd(d);
    const hit = byDate.get(key);
    out.push({ date: key, revenue_cents: hit?.revenue_cents ?? 0, orders: hit?.orders ?? 0 });
  }
  return out;
}
