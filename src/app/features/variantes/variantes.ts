import { Component, inject, input, OnInit, signal } from '@angular/core';
import { disabled, form, FormField, min, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminVariant, VariantInput } from '../../api/generated/model';
import { centsToPesos, formatMxn, pesosToCents } from '../../core/money';
import { importErrors, problemMessage } from '../../core/problem';
import { StockAdjust } from '../inventario/stock-adjust';

interface VariantForm {
  sku: string;
  sphere: number | null;
  cylinder: number | null;
  axis: number | null;
  addition: string;
  base_curve: number | null;
  diameter: number | null;
  color: string;
  price_pesos: number | null;
  compare_at_pesos: number | null;
  stock: number;
  active: boolean;
}

const empty = (): VariantForm => ({
  sku: '', sphere: null, cylinder: null, axis: null, addition: '', base_curve: null, diameter: null,
  color: '', price_pesos: null, compare_at_pesos: null, stock: 0, active: true,
});

const fmt = (n: number | null | undefined) => (n == null ? '—' : String(n));

@Component({
  selector: 'app-variantes',
  imports: [FormField, RouterLink, StockAdjust],
  template: `
    <a routerLink="/productos" class="text-sm underline">← Productos</a>
    <div class="my-4 flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Variantes</h1>
      <button type="button" class="rounded bg-slate-900 px-3 py-2 text-sm text-white" (click)="startCreate()">Nueva variante</button>
    </div>

    @if (editing()) {
      <section class="mb-8 max-w-3xl rounded border border-slate-200 p-4" aria-labelledby="vtitle">
        <h2 id="vtitle" class="mb-3 font-medium">{{ editingId() ? 'Editar variante' : 'Nueva variante' }}</h2>
        <form class="grid gap-3 sm:grid-cols-3" (submit)="save($event)">
          <div class="sm:col-span-3">
            <label for="sku" class="mb-1 block text-sm">SKU</label>
            <input id="sku" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.sku" />
          </div>
          <div>
            <label for="sphere" class="mb-1 block text-sm">Esfera</label>
            <input id="sphere" type="number" step="0.25" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.sphere" />
          </div>
          <div>
            <label for="cyl" class="mb-1 block text-sm">Cilindro</label>
            <input id="cyl" type="number" step="0.25" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.cylinder" />
          </div>
          <div>
            <label for="axis" class="mb-1 block text-sm">Eje</label>
            <input id="axis" type="number" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.axis" />
          </div>
          <div>
            <label for="add" class="mb-1 block text-sm">Adición</label>
            <input id="add" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.addition" />
          </div>
          <div>
            <label for="bc" class="mb-1 block text-sm">Curva base</label>
            <input id="bc" type="number" step="0.1" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.base_curve" />
          </div>
          <div>
            <label for="dia" class="mb-1 block text-sm">Diámetro</label>
            <input id="dia" type="number" step="0.1" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.diameter" />
          </div>
          <div>
            <label for="color" class="mb-1 block text-sm">Color (cosméticos)</label>
            <input id="color" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.color" />
          </div>
          <div>
            <label for="price" class="mb-1 block text-sm">Precio (MXN)</label>
            <input id="price" type="number" step="0.01" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.price_pesos" />
          </div>
          <div>
            <label for="cmp" class="mb-1 block text-sm">Precio de lista (MXN)</label>
            <input id="cmp" type="number" step="0.01" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.compare_at_pesos" />
          </div>
          <div>
            <label for="stock" class="mb-1 block text-sm">Existencia @if (editingId()) { <span class="text-xs text-slate-500">(usa “Ajustar”)</span> }</label>
            <input id="stock" type="number" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.stock" />
          </div>
          <label class="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" [formField]="model.active" /> Activa (a la venta)</label>
          @if (error()) { <p role="alert" class="text-sm text-red-700 sm:col-span-3">{{ error() }}</p> }
          <div class="flex gap-2 sm:col-span-3">
            <button type="submit" class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" [disabled]="busy()">Guardar</button>
            <button type="button" class="rounded border border-slate-300 px-3 py-2" (click)="editing.set(false)">Cancelar</button>
          </div>
        </form>
      </section>
    }

    @if (adjusting(); as v) {
      <div class="mb-8 max-w-3xl">
        <app-stock-adjust [variantId]="v.id" [sku]="v.sku" [stock]="v.stock" (adjusted)="onAdjusted()" (closed)="adjusting.set(null)" />
      </div>
    }

    <section class="mb-8 max-w-3xl rounded border border-slate-200 p-4" aria-labelledby="imp">
      <h2 id="imp" class="mb-1 font-medium">Carga masiva por CSV</h2>
      <p class="mb-3 text-sm text-slate-600">
        Se actualiza por SKU. Todo o nada: si una fila falla, no se aplica nada. Máx. 5 MB y 5,000 filas.
        Columnas: product_slug, sku, sphere, cylinder, axis, addition, base_curve, diameter, color, price_cents, compare_at_cents, stock, active.
      </p>
      <label for="csv" class="mb-1 block text-sm">Archivo CSV</label>
      <input id="csv" type="file" accept=".csv,text/csv" class="mb-3 block text-sm" (change)="pickFile($event)" />
      <button type="button" class="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" [disabled]="!file() || importing()" (click)="runImport()">
        {{ importing() ? 'Importando…' : 'Importar' }}
      </button>
      @if (importOk()) { <p role="status" class="mt-3 text-sm">{{ importOk() }}</p> }
      @if (importError()) { <p role="alert" class="mt-3 text-sm text-red-700">{{ importError() }}</p> }
      @if (rowErrors().length) {
        <ul class="mt-2 max-h-48 overflow-auto text-sm text-red-700">
          @for (e of rowErrors(); track e.row) { <li>Fila {{ e.row }}: {{ e.message }}</li> }
        </ul>
      }
    </section>

    @if (loadError()) { <p role="alert" class="mb-4 text-sm text-red-700">{{ loadError() }}</p> }
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left">
        <th class="py-2">SKU</th><th>Esf</th><th>Cil</th><th>Eje</th><th>Add</th><th>CB</th><th>Diám</th>
        <th>Precio</th><th>Existencia</th><th>Apartado</th><th>Estado</th><th></th>
      </tr></thead>
      <tbody>
        @for (v of variants(); track v.id) {
          <tr class="border-b">
            <td class="py-2">{{ v.sku }}</td><td>{{ f(v.sphere) }}</td><td>{{ f(v.cylinder) }}</td><td>{{ f(v.axis) }}</td>
            <td>{{ v.addition ?? '—' }}</td><td>{{ v.base_curve }}</td><td>{{ v.diameter }}</td>
            <td>{{ money(v.price_cents) }}</td><td>{{ v.stock }}</td><td>{{ v.reserved }}</td>
            <td>{{ v.active ? 'Activa' : 'Inactiva' }}</td>
            <td class="space-x-3 text-right">
              <button type="button" class="underline" (click)="startEdit(v)">Editar</button>
              <button type="button" class="underline" (click)="adjusting.set(v)">Ajustar existencia</button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="12" class="py-4 text-slate-500">Este producto aún no tiene variantes.</td></tr>
        }
      </tbody>
    </table>
  `,
})
export default class Variantes implements OnInit {
  /** :productId de la ruta (withComponentInputBinding). */
  readonly productId = input.required<string>();
  private readonly api = inject(DefaultService);
  protected readonly variants = signal<AdminVariant[]>([]);
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly adjusting = signal<AdminVariant | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);

  protected readonly file = signal<File | null>(null);
  protected readonly importing = signal(false);
  protected readonly importOk = signal<string | null>(null);
  protected readonly importError = signal<string | null>(null);
  protected readonly rowErrors = signal<{ row: number; message: string }[]>([]);

  protected f = fmt;
  protected money = formatMxn;

  private readonly state = signal<VariantForm>(empty());
  protected readonly model = form(this.state, (p) => {
    required(p.sku);
    required(p.base_curve);
    required(p.diameter);
    required(p.price_pesos);
    min(p.price_pesos, 0.01);
    min(p.stock, 0);
    // Al editar, la existencia solo cambia con "Ajustar existencia" (queda motivo e historial).
    disabled(p.stock, () => this.editingId() !== null);
  });

  ngOnInit() {
    return this.load();
  }

  private async load() {
    try {
      const res = await firstValueFrom(this.api.adminListVariants({ product_id: this.productId() }));
      this.variants.set(res.items);
      this.loadError.set(null);
    } catch (e) {
      this.loadError.set(problemMessage(e, 'No se pudieron cargar las variantes.'));
    }
  }

  protected startCreate() {
    this.editingId.set(null);
    this.state.set(empty());
    this.error.set(null);
    this.editing.set(true);
  }

  protected startEdit(v: AdminVariant) {
    this.editingId.set(v.id);
    this.state.set({
      sku: v.sku, sphere: v.sphere ?? null, cylinder: v.cylinder ?? null, axis: v.axis ?? null,
      addition: v.addition ?? '', base_curve: v.base_curve, diameter: v.diameter, color: v.color ?? '',
      price_pesos: centsToPesos(v.price_cents),
      compare_at_pesos: v.compare_at_cents == null ? null : centsToPesos(v.compare_at_cents),
      stock: v.stock, active: v.active,
    });
    this.error.set(null);
    this.editing.set(true);
  }

  protected async save(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return this.error.set('Revisa los campos obligatorios.');
    const s = this.state();
    const body: VariantInput = {
      product_id: this.productId(), sku: s.sku.trim(),
      sphere: s.sphere, cylinder: s.cylinder, axis: s.axis, addition: s.addition.trim() || null,
      base_curve: s.base_curve!, diameter: s.diameter!, color: s.color.trim() || null,
      price_cents: pesosToCents(s.price_pesos!),
      compare_at_cents: s.compare_at_pesos == null ? null : pesosToCents(s.compare_at_pesos),
      stock: s.stock, active: s.active,
    };
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      await firstValueFrom(id ? this.api.adminUpdateVariant(id, body) : this.api.adminCreateVariant(body));
      await this.load();
      this.editing.set(false);
    } catch (e) {
      this.error.set(problemMessage(e, 'No se pudo guardar (¿SKU o combinación repetida?).'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async onAdjusted() {
    const id = this.adjusting()?.id;
    await this.load();
    this.adjusting.set(this.variants().find((v) => v.id === id) ?? null);
  }

  protected pickFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.importOk.set(null);
    this.importError.set(null);
    this.rowErrors.set([]);
    if (f && f.size > 5 * 1024 * 1024) {
      this.file.set(null);
      return this.importError.set('El archivo pesa más de 5 MB.');
    }
    this.file.set(f);
  }

  protected async runImport() {
    const f = this.file();
    if (!f) return;
    this.importing.set(true);
    this.importOk.set(null);
    this.importError.set(null);
    this.rowErrors.set([]);
    try {
      const res = await firstValueFrom(this.api.adminImportVariants(f, { headers: { 'Content-Type': 'text/csv' } }));
      this.importOk.set(`Listo: ${res.created} creadas, ${res.updated} actualizadas.`);
      await this.load();
    } catch (e) {
      this.importError.set(problemMessage(e, 'El archivo no es válido. No se aplicó ningún cambio.'));
      this.rowErrors.set(importErrors(e));
    } finally {
      this.importing.set(false);
    }
  }
}
