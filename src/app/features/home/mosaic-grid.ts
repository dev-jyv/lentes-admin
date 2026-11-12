import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import type { AdminHomeBanner } from '../../api/generated/model';
import { REORDER_SLOT } from '../../core/banner-form';
import { TPipe } from '../../core/i18n';

export interface MosaicCell {
  slot: string;
  label: string;
  /** Banner vigente que la tienda muestra en la celda; `null` si no hay. */
  banner: AdminHomeBanner | null;
}

/**
 * Las 7 celdas del mosaico en una cuadrícula que imita el home (SPEC 15, punto 25): arriba la foto grande de armazones,
 * lentes y el bloque de reposición; abajo los tipos de lente. Cada celda muestra su foto vigente o el aviso del bloque de color.
 */
@Component({
  selector: 'app-mosaic-grid',
  imports: [NgTemplateOutlet, TPipe],
  template: `
    <ng-template #cellTpl let-c>
      @if (c.slot === reorderSlot) {
        <div class="flex h-full min-h-32 flex-col justify-between gap-3 rounded-2xl bg-secondary p-4">
          <span class="text-xs font-semibold text-muted-foreground">{{ c.label }}</span>
          @if (c.banner) {
            <span><span class="block font-display text-lg font-bold">{{ c.banner.title }}</span>
              @if (c.banner.subtitle) { <span class="block text-sm">{{ c.banner.subtitle }}</span> }</span>
          } @else {
            <span class="text-sm text-muted-foreground">{{ 'homeAdmin.mosaicNoReorder' | t }}</span>
          }
          <button type="button" class="btn btn-secondary btn-sm self-start" [attr.aria-label]="(c.banner ? 'homeAdmin.mosaicEditCell' : 'homeAdmin.mosaicAddCell') | t: { cell: c.label }" (click)="pick.emit(c)">{{ c.banner ? ('common.edit' | t) : ('homeAdmin.add' | t) }}</button>
        </div>
      } @else if (c.banner?.image_url) {
        <div class="relative h-full min-h-32 overflow-hidden rounded-2xl bg-band">
          <img [src]="c.banner.image_url" [attr.alt]="c.banner.image_alt ?? ''" class="absolute inset-0 size-full object-cover" loading="lazy" />
          <span class="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-band/85 to-transparent" aria-hidden="true"></span>
          <span class="absolute bottom-3 left-4 font-display text-lg font-bold text-white">{{ c.label }}</span>
          <button type="button" class="btn btn-secondary btn-sm absolute top-3 right-3" [attr.aria-label]="'homeAdmin.mosaicChangePhoto' | t: { cell: c.label }" (click)="pick.emit(c)">{{ 'homeAdmin.changePhoto' | t }}</button>
        </div>
      } @else {
        <div class="flex h-full min-h-32 flex-col justify-between gap-3 rounded-2xl border border-dashed border-input bg-muted/60 p-4">
          <span class="font-display text-lg font-bold">{{ c.label }}</span>
          <span class="text-sm text-muted-foreground">{{ 'homeAdmin.mosaicNoPhoto' | t }}</span>
          <button type="button" class="btn btn-secondary btn-sm self-start" [attr.aria-label]="'homeAdmin.mosaicAddPhoto' | t: { cell: c.label }" (click)="pick.emit(c)">{{ 'homeAdmin.addPhoto' | t }}</button>
        </div>
      }
    </ng-template>

    <div class="space-y-3">
      <div class="grid gap-3 lg:grid-cols-[2fr_1fr] lg:grid-rows-[11rem_11rem]">
        @for (c of top(); track c.slot; let first = $first) {
          <div [class]="first ? 'aspect-[4/3] lg:row-span-2 lg:aspect-auto' : ''">
            <ng-container [ngTemplateOutlet]="cellTpl" [ngTemplateOutletContext]="{ $implicit: c }" />
          </div>
        }
      </div>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        @for (c of bottom(); track c.slot) {
          <div><ng-container [ngTemplateOutlet]="cellTpl" [ngTemplateOutletContext]="{ $implicit: c }" /></div>
        }
      </div>
    </div>
  `,
})
export class MosaicGrid {
  readonly cells = input.required<MosaicCell[]>();
  readonly pick = output<MosaicCell>();
  protected readonly reorderSlot = REORDER_SLOT;
  protected readonly top = computed(() => this.cells().filter((c) => !c.slot.startsWith('lens_type:')));
  protected readonly bottom = computed(() => this.cells().filter((c) => c.slot.startsWith('lens_type:')));
}
