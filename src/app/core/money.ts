const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** La API maneja centavos; aquí solo se formatea para mostrar. */
export const formatMxn = (cents: number): string => mxn.format(cents / 100);

/** Pesos escritos por el admin a centavos enteros, sin pasar por float acumulado. */
export const pesosToCents = (pesos: number): number => Math.round(pesos * 100);
export const centsToPesos = (cents: number): number => cents / 100;
