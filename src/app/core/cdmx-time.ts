const ZONE = 'America/Mexico_City';

const parts = (date: Date) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
};

/** Valor para `<input type="datetime-local">`, en hora de la Ciudad de México sin importar la zona del navegador. */
export function utcToCdmxInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = parts(new Date(iso));
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
}

/** Convierte lo capturado en hora de la Ciudad de México a UTC (ISO). Vacío o inválido da null. */
export function cdmxInputToUtc(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // La diferencia entre el valor pedido y cómo se ve ese instante en la zona es su desfase.
  const seen = parts(new Date(asUtc));
  const seenUtc = Date.UTC(+seen['year'], +seen['month'] - 1, +seen['day'], +seen['hour'], +seen['minute']);
  return new Date(asUtc + (asUtc - seenUtc)).toISOString();
}
