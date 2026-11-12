import { Component, signal } from '@angular/core';
import { t, TPipe } from '../../core/i18n';
import LensPackages from './paquetes';
import LensTreatments from './tratamientos';

type Tab = 'packages' | 'treatments';

/** Pantalla "Micas" (SPEC 17): necesidades visuales (paquetes) y tratamientos, en pestañas. */
@Component({
  selector: 'app-micas',
  imports: [TPipe, LensPackages, LensTreatments],
  template: `
    <h1 class="page-title mb-4">{{ 'nav.micas' | t }}</h1>
    <div role="tablist" [attr.aria-label]="'micas.tabsLabel' | t" class="mb-5 flex flex-wrap gap-2">
      @for (x of tabs; track x.value) {
        <button type="button" role="tab" class="chip" [attr.aria-selected]="tab() === x.value" (click)="tab.set(x.value)">{{ x.label }}</button>
      }
    </div>
    @if (tab() === 'packages') { <app-lens-packages /> } @else { <app-lens-treatments /> }
  `,
})
export default class Micas {
  protected readonly tabs: { value: Tab; label: string }[] = [
    { value: 'packages', label: t('micas.tabs.packages') },
    { value: 'treatments', label: t('micas.tabs.treatments') },
  ];
  protected readonly tab = signal<Tab>('packages');
}
