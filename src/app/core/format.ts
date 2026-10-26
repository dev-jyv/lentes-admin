const dt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const d = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' });

export const formatDateTime = (iso: string): string => dt.format(new Date(iso));
/** Fechas sin hora (YYYY-MM-DD) se fijan en UTC para no correrse un día por zona horaria. */
export const formatDate = (isoDate: string): string => d.format(new Date(`${isoDate}T00:00:00Z`));
