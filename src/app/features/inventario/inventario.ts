import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { LowStockItem } from '../../api/provisional/model';
import { InventoryService } from '../../api/provisional/inventory/inventory.service';
import { problemMessage } from '../../core/problem';
import { StockAdjust } from './stock-adjust';

@Component({
  selector: 'app-inventario',
  imports: [RouterLink, StockAdjust],
  template: `
    <h1 class="mb-2 text-2xl font-semibold">Inventario</h1>
    <p class="mb-6 text-sm text-slate-600">Variantes activas con existencia disponible (stock − apartado) igual o menor al umbral.</p>
    <div class="mb-4 flex items-center gap-2 text-sm">
      <label for="thr">Umbral</label>
      <input id="thr" type="number" min="0" class="w-24 rounded border border-slate-300 px-3 py-2" [value]="threshold()" (change)="setThreshold($event)" />
    </div>
    @if (error()) { <p role="alert" class="mb-4 text-sm text-red-700">{{ error() }}</p> }
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left"><th class="py-2">SKU</th><th>Producto</th><th>Existencia</th><th>Apartado</th><th>Disponible</th><th></th></tr></thead>
      <tbody>
        @for (v of items(); track v.variant_id) {
          <tr class="border-b">
            <td class="py-2">{{ v.sku }}</td>
            <td>{{ v.brand_name }} · {{ v.product_name }}</td>
            <td>{{ v.stock }}</td><td>{{ v.reserved }}</td>
            <td [class.text-red-700]="v.available <= 0" [class.font-medium]="v.available <= 0">{{ v.available }}</td>
            <td class="space-x-3 text-right">
              <button type="button" class="underline" (click)="selected.set(v)">Ajustar</button>
              <a class="underline" [routerLink]="['/productos', v.product_id, 'variantes']">Variantes</a>
            </td>
          </tr>
        } @empty { <tr><td colspan="6" class="py-4 text-slate-500">Nada por reponer con ese umbral.</td></tr> }
      </tbody>
    </table>
    @if (selected(); as v) {
      <div class="mt-6 max-w-3xl">
        <app-stock-adjust [variantId]="v.variant_id" [sku]="v.sku" [stock]="v.stock" (adjusted)="onAdjusted($event)" (closed)="selected.set(null)" />
      </div>
    }
  `,
})
export default class Inventario implements OnInit {
  private readonly api = inject(InventoryService);
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
      this.error.set(problemMessage(e, 'No se pudo cargar el inventario.'));
    }
  }
}
