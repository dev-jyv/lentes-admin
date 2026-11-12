import { Component, computed, input } from '@angular/core';
import type { PromiseIcon } from '../api/generated/model';

// Mismo dibujo (trazo 2, retícula 24) que los íconos de la franja de promesas de lentes-web, para que la vista previa
// se parezca a lo que verá el cliente.
const PATHS: Record<PromiseIcon, string[]> = {
  prescription: ['M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4', 'M14 2v4a2 2 0 0 0 2 2h4', 'm3 15 2 2 4-4'],
  reorder: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5'],
  payment: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
  support: ['M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z', 'M21 16v2a4 4 0 0 1-4 4h-5'],
  delivery: ['M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2', 'M15 18H9', 'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14', 'M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0', 'M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0'],
  quality: ['M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z', 'm9 12 2 2 4-4'],
};

/** Vista previa del ícono de una promesa. Decorativo: el nombre del ícono va en texto junto a él. */
@Component({
  selector: 'app-promise-icon',
  host: { class: 'inline-grid shrink-0 place-items-center' },
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="size-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      @for (d of paths(); track $index) { <path [attr.d]="d" /> }
    </svg>
  `,
})
export class PromiseIconView {
  readonly icon = input.required<PromiseIcon>();
  protected readonly paths = computed(() => PATHS[this.icon()] ?? []);
}
