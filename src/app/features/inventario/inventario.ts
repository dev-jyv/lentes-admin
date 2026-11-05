import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { LowStockItem } from '../../api/generated/model';
import { problemMessage } from '../../core/problem';
import { StockAdjust } from './stock-adjust';
import { t, TPipe } from '../../core/i18n';

@Component({
  selector: 'app-inventario',
  imports: [RouterLink, StockAdjust, TPipe],
  template: `
    <h1 class="page-title mb-1">{{ 'nav.inventario' | t }}</h1>
    <p class="mb-6 text-sm text-muted-foreground">{{ 'inventario.description' | t }}</p>
    <div class="mb-4 flex items-center gap-3">
      <label for="thr" class="text-sm font-medium">{{ 'inventario.threshold' | t }}</label>
      <input id="thr" type="number" min="0" class="field w-24" [value]="threshold()" (change)="setThreshold($event)" />
    </div>
    @if (error()) { <p role="alert" class="alert-error mb-4">{{ error() }}</p> }
    <!-- El ajuste se abre arriba de la lista para no perderlo de vista en listas largas. -->
    @if (selected(); as v) {
      <div class="mb-6 max-w-3xl">
        <app-stock-adjust [variantId]="v.variant_id" [sku]="v.sku" [stock]="v.stock" (adjusted)="onAdjusted($event)" (closed)="selected.set(null)" />
      </div>
    }
    <div class="panel overflow-x-auto">
      <table class="data-table stack">
        <thead>
          <tr>
            <th scope="col">{{ 'common.product' | t }}</th>
            <th scope="col">{{ 'common.sku' | t }}</th>
            <th scope="col" class="text-right">{{ 'inventario.stock' | t }}</th>
            <th scope="col" class="text-right">{{ 'inventario.reserved' | t }}</th>
            <th scope="col" class="text-right">{{ 'inventario.available' | t }}</th>
            <th scope="col"><span class="sr-only">{{ 'inventario.adjust' | t }}</span></th>
          </tr>
        </thead>
        <tbody>
          @for (v of items(); track v.variant_id) {
            <tr>
              <td>{{ v.product_name }} <span class="font-normal text-muted-foreground">· {{ v.brand_name }}</span></td>
              <td class="optic" [attr.data-label]="'common.sku' | t">{{ v.sku }}</td>
              <td class="text-right tabular-nums" [attr.data-label]="'inventario.stock' | t">{{ v.stock }}</td>
              <td class="text-right tabular-nums" [attr.data-label]="'inventario.reserved' | t">{{ v.reserved }}</td>
              <td class="text-right" [attr.data-label]="'inventario.available' | t">
                <span class="pill font-semibold tabular-nums" [class]="v.available <= 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-soft'">{{ v.available }}</span>
              </td>
              <td class="actions">
                <button type="button" class="link" (click)="selected.set(v)">{{ 'inventario.adjust' | t }}</button>
                <a class="link" [routerLink]="['/productos', v.product_id, 'variantes']">{{ 'inventario.variants' | t }}</a>
              </td>
            </tr>
          } @empty { <tr><td colspan="6" class="empty">{{ 'inventario.empty' | t }}</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export default class Inventario implements OnInit {
  private readonly api = inject(DefaultService);
  protected readonly items = signal<LowStockItem[]>([]);
  protected readonly threshold = signal(5);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = signal<LowStockItem | null>(null);

  ngOnInit() {
    return this.load();
  }

  protected setThreshold(e: Event) {
    const n = Number((e.target as HTMLInputElement).value);
    this.threshold.set(Number.isInteger(n) && n >= 0 ? n : 5);
    return this.load();
  }

  protected async onAdjusted(newStock: number) {
    // El panel sigue abierto (confirmación e historial) aunque la variante salga de la lista al reponerla.
    this.selected.update((v) => (v ? { ...v, stock: newStock } : v));
    await this.load();
  }

  private async load() {
    try {
      this.items.set((await firstValueFrom(this.api.adminListLowStock({ threshold: this.threshold() }))).items);
      this.error.set(null);
    } catch (e) {
      this.error.set(problemMessage(e, t('inventario.loadFailed')));
    }
  }
}
