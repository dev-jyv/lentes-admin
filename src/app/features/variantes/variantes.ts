import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { disabled, form, FormField, min, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminVariant, VariantInput } from '../../api/generated/model';
import { COLOR_LABEL, toOptions } from '../../core/frame-labels';
import { centsToPesos, formatMxn, pesosToCents } from '../../core/money';
import { importErrors, problemMessage } from '../../core/problem';
import { StockAdjust } from '../inventario/stock-adjust';
import { t, TPipe } from '../../core/i18n';

interface VariantForm {
  sku: string;
  sphere: number | null;
  cylinder: number | null;
  axis: number | null;
  addition: string;
  dominance: string;
  base_curve: number | null;
  diameter: number | null;
  color: string;
  price_pesos: number | null;
  compare_at_pesos: number | null;
  stock: number;
  on_demand: boolean;
  active: boolean;
}

const empty = (): VariantForm => ({
  sku: '', sphere: null, cylinder: null, axis: null, addition: '', dominance: '', base_curve: null, diameter: null,
  color: '', price_pesos: null, compare_at_pesos: null, stock: 0, on_demand: false, active: true,
});

/** Una tabla con miles de filas congela el navegador: se pinta hasta este tope y se filtra por SKU. */
const MAX_ROWS = 200;

const fmt = (n: number | null | undefined) => (n == null ? '—' : String(n));

@Component({
  selector: 'app-variantes',
  imports: [FormField, RouterLink, StockAdjust, TPipe],
  template: `
    <a routerLink="/productos" class="back-link">{{ 'imagenes.back' | t }}</a>
    <div class="my-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="page-title">{{ 'inventario.variants' | t }}</h1>
      <button type="button" class="btn btn-primary" (click)="startCreate()">{{ 'variantes.new' | t }}</button>
    </div>

    @if (editing()) {
      <section class="panel mb-8 max-w-3xl p-5 shadow-[0_4px_16px_rgb(14_34_48/0.08)]" aria-labelledby="vtitle">
        <h2 id="vtitle" class="mb-3 text-lg">{{ editingId() ? ('variantes.edit' | t) : ('variantes.new' | t) }}</h2>
        <form class="grid gap-4 sm:grid-cols-3" (submit)="save($event)">
          <div class="sm:col-span-3">
            <label for="sku" class="field-label">{{ 'common.sku' | t }}</label>
            <input id="sku" class="field w-full" [formField]="model.sku" />
          </div>
          @if (isFrame()) {
            <div>
              <label for="fcolor" class="field-label">{{ 'variantes.color' | t }}</label>
              <select id="fcolor" class="field w-full" [formField]="model.color">
                <option value="">{{ 'common.choose' | t }}</option>
                @for (o of frameColors; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
          } @else {
          <div>
            <label for="sphere" class="field-label">{{ 'variantes.sphere' | t }}</label>
            <input id="sphere" type="number" step="0.25" class="field w-full" [formField]="model.sphere" />
          </div>
          <div>
            <label for="cyl" class="field-label">{{ 'variantes.cylinder' | t }}</label>
            <input id="cyl" type="number" step="0.25" class="field w-full" [formField]="model.cylinder" />
          </div>
          <div>
            <label for="axis" class="field-label">{{ 'variantes.axis' | t }}</label>
            <input id="axis" type="number" class="field w-full" [formField]="model.axis" />
          </div>
          <div>
            <label for="add" class="field-label">{{ 'variantes.addition' | t }}</label>
            <input id="add" class="field w-full" [formField]="model.addition" />
          </div>
          <div>
            <label for="dom" class="field-label">{{ 'variantes.dominance' | t }}</label>
            <select id="dom" class="field w-full" [formField]="model.dominance">
              <option value="">{{ 'variantes.noDominance' | t }}</option>
              <option value="D">D</option>
              <option value="N">N</option>
            </select>
          </div>
          <div>
            <label for="bc" class="field-label">{{ 'variantes.baseCurve' | t }}</label>
            <input id="bc" type="number" step="0.1" class="field w-full" [formField]="model.base_curve" />
          </div>
          <div>
            <label for="dia" class="field-label">{{ 'variantes.diameter' | t }}</label>
            <input id="dia" type="number" step="0.1" class="field w-full" [formField]="model.diameter" />
          </div>
          <div>
            <label for="color" class="field-label">{{ 'variantes.cosmeticColor' | t }}</label>
            <input id="color" class="field w-full" [formField]="model.color" />
          </div>
          }
          <div>
            <label for="price" class="field-label">{{ 'micas.pricePesos' | t }}</label>
            <input id="price" type="number" step="0.01" class="field w-full" [formField]="model.price_pesos" />
          </div>
          <div>
            <label for="cmp" class="field-label">{{ 'variantes.listPrice' | t }}</label>
            <input id="cmp" type="number" step="0.01" class="field w-full" [formField]="model.compare_at_pesos" />
          </div>
          <div>
            <label for="stock" class="field-label">{{ 'inventario.stock' | t }} @if (editingId()) { <span class="text-xs text-muted-foreground">{{ 'variantes.useAdjust' | t }}</span> }</label>
            <input id="stock" type="number" class="field w-full" [formField]="model.stock" />
          </div>
          @if (!isFrame()) {
            <label class="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" [formField]="model.on_demand" /> {{ 'variantes.onDemandHelp' | t }}</label>
          }
          <label class="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" [formField]="model.active" /> {{ 'variantes.activeForSale' | t }}</label>
          @if (error()) { <p role="alert" class="alert-error sm:col-span-3">{{ error() }}</p> }
          <div class="flex flex-wrap gap-2 border-t border-border pt-4 sm:col-span-3">
            <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ 'common.save' | t }}</button>
            <button type="button" class="btn btn-secondary" (click)="editing.set(false)">{{ 'common.cancel' | t }}</button>
          </div>
        </form>
      </section>
    }

    @if (adjusting(); as v) {
      <div class="mb-8 max-w-3xl">
        <app-stock-adjust [variantId]="v.id" [sku]="v.sku" [stock]="v.stock" (adjusted)="onAdjusted()" (closed)="adjusting.set(null)" />
      </div>
    }

    @if (!isFrame()) {
    <section class="panel mb-8 max-w-3xl p-5" aria-labelledby="imp">
      <h2 id="imp" class="mb-1 text-lg">{{ 'variantes.csvTitle' | t }}</h2>
      <p class="mb-3 text-sm text-muted-foreground">
        {{ 'variantes.csvHelp' | t }}
      </p>
      <label for="csv" class="field-label">{{ 'variantes.csvFile' | t }}</label>
      <input id="csv" type="file" accept=".csv,text/csv" class="mb-4 block" (change)="pickFile($event)" />
      <button type="button" class="btn btn-primary" [disabled]="!file() || importing()" (click)="runImport()">
        {{ importing() ? ('variantes.importing' | t) : ('variantes.import' | t) }}
      </button>
      @if (importOk()) { <p role="status" class="alert-ok mt-3">{{ importOk() }}</p> }
      @if (importError()) { <p role="alert" class="alert-error mt-3">{{ importError() }}</p> }
      @if (rowErrors().length) {
        <ul class="mt-2 max-h-48 list-disc overflow-auto rounded-lg bg-destructive/10 py-2 pr-4 pl-8 text-sm text-destructive">
          @for (e of rowErrors(); track e.row) { <li>{{ 'variantes.rowError' | t: { row: e.row, message: e.message } }}</li> }
        </ul>
      }
    </section>
    }

    @if (loadError()) { <p role="alert" class="alert-error mb-4">{{ loadError() }}</p> }
    @if (variants().length > maxRows) {
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label for="vfilter" class="text-sm font-medium">{{ 'variantes.filterSku' | t }}</label>
        <input id="vfilter" class="field optic" [value]="filter()" (input)="filter.set($any($event.target).value)" />
        <p role="status" class="text-sm text-muted-foreground">{{ 'variantes.showing' | t: { shown: visible().length, total: filtered().length } }}</p>
      </div>
    }
    <div class="panel overflow-x-auto">
      <table class="data-table">
        <thead><tr>
          <th>{{ 'common.sku' | t }}</th>
          @if (isFrame()) { <th>{{ 'variantes.color' | t }}</th> } @else {
            <th class="text-right">{{ 'variantes.abbr.sphere' | t }}</th><th class="text-right">{{ 'variantes.abbr.cylinder' | t }}</th><th class="text-right">{{ 'variantes.axis' | t }}</th>
            <th class="text-right">{{ 'variantes.abbr.addition' | t }}</th><th class="text-center">{{ 'variantes.abbr.dominance' | t }}</th><th class="text-right">{{ 'variantes.abbr.baseCurve' | t }}</th><th class="text-right">{{ 'variantes.abbr.diameter' | t }}</th>
          }
          <th class="text-right">{{ 'common.price' | t }}</th><th class="text-right">{{ 'inventario.stock' | t }}</th><th class="text-right">{{ 'inventario.reserved' | t }}</th><th>{{ 'common.status' | t }}</th><th><span class="sr-only">{{ 'common.edit' | t }}</span></th>
        </tr></thead>
        <tbody>
          @for (v of visible(); track v.id) {
            <tr>
              <td class="optic font-medium">{{ v.sku }}</td>
              @if (isFrame()) {
                <td>{{ colorLabel(v.color) }}</td>
              } @else {
                <td class="optic text-right">{{ f(v.sphere) }}</td><td class="optic text-right">{{ f(v.cylinder) }}</td><td class="optic text-right">{{ f(v.axis) }}</td>
                <td class="optic text-right">{{ v.addition ?? '—' }}</td><td class="optic text-center">{{ v.dominance ?? '—' }}</td><td class="optic text-right">{{ f(v.base_curve) }}</td><td class="optic text-right">{{ f(v.diameter) }}</td>
              }
              <td class="text-right font-semibold tabular-nums">{{ money(v.price_cents) }}</td>
              <td class="text-right tabular-nums">@if (v.on_demand) { <span class="pill">{{ 'variantes.onDemand' | t }}</span> } @else { {{ v.stock }} }</td>
              <td class="text-right tabular-nums">{{ v.reserved }}</td>
              <td><span class="pill"><span class="size-1.5 rounded-full" [class]="v.active ? 'bg-good' : 'bg-muted-foreground'" aria-hidden="true"></span>{{ v.active ? ('variantes.active' | t) : ('variantes.inactive' | t) }}</span></td>
              <td class="actions">
                <button type="button" class="link" (click)="startEdit(v)">{{ 'common.edit' | t }}</button>
                @if (!v.on_demand) {
                  <button type="button" class="link" (click)="adjusting.set(v)">{{ 'variantes.adjustStock' | t }}</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="13" class="empty">{{ 'variantes.empty' | t }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export default class Variantes implements OnInit {
  /** :productId de la ruta (withComponentInputBinding). */
  readonly productId = input.required<string>();
  /** ?categoria= del enlace en Productos (withComponentInputBinding). Sin ella se asume lente de contacto; la API valida de todos modos. */
  readonly categoria = input<string>();
  protected readonly isFrame = computed(() => this.categoria() === 'frame');
  protected readonly frameColors = toOptions(COLOR_LABEL);
  protected colorLabel = (c: string | null | undefined) => (c ? (COLOR_LABEL[c as keyof typeof COLOR_LABEL] ?? c) : '—');
  private readonly api = inject(DefaultService);
  protected readonly variants = signal<AdminVariant[]>([]);
  protected readonly maxRows = MAX_ROWS;
  protected readonly filter = signal('');
  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    return q ? this.variants().filter((v) => v.sku.toLowerCase().includes(q)) : this.variants();
  });
  protected readonly visible = computed(() => this.filtered().slice(0, MAX_ROWS));
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
    required(p.base_curve, { when: () => !this.isFrame() });
    required(p.diameter, { when: () => !this.isFrame() });
    required(p.color, { when: () => this.isFrame() });
    required(p.price_pesos);
    min(p.price_pesos, 0.01);
    min(p.stock, 0);
    // Al editar, la existencia solo cambia con "Ajustar existencia" (queda motivo e historial).
    disabled(p.stock, ({ valueOf }) => this.editingId() !== null || valueOf(p.on_demand));
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
      this.loadError.set(problemMessage(e, t('variantes.loadFailed')));
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
      addition: v.addition ?? '', dominance: v.dominance ?? '', base_curve: v.base_curve ?? null, diameter: v.diameter ?? null, color: v.color ?? '',
      price_pesos: centsToPesos(v.price_cents),
      compare_at_pesos: v.compare_at_cents == null ? null : centsToPesos(v.compare_at_cents),
      stock: v.stock, on_demand: v.on_demand, active: v.active,
    });
    this.error.set(null);
    this.editing.set(true);
  }

  protected async save(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return this.error.set(t('common.checkRequired'));
    const s = this.state();
    const body: VariantInput = {
      product_id: this.productId(), sku: s.sku.trim(),
      ...(this.isFrame()
        ? {}
        : {
            sphere: s.sphere, cylinder: s.cylinder, axis: s.axis, addition: s.addition.trim() || null,
            dominance: s.dominance || null, on_demand: s.on_demand,
            base_curve: s.base_curve, diameter: s.diameter,
          }),
      color: s.color.trim() || null,
      price_cents: pesosToCents(s.price_pesos!),
      compare_at_cents: s.compare_at_pesos == null ? null : pesosToCents(s.compare_at_pesos),
      stock: s.on_demand ? 0 : s.stock, active: s.active,
    };
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      await firstValueFrom(id ? this.api.adminUpdateVariant(id, body) : this.api.adminCreateVariant(body));
      await this.load();
      this.editing.set(false);
    } catch (e) {
      this.error.set(problemMessage(e, t('variantes.saveFailed')));
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
      return this.importError.set(t('variantes.fileTooLarge'));
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
      this.importOk.set(t('variantes.importDone', { created: res.created, updated: res.updated }));
      await this.load();
    } catch (e) {
      this.importError.set(problemMessage(e, t('variantes.importFailed')));
      this.rowErrors.set(importErrors(e));
    } finally {
      this.importing.set(false);
    }
  }
}
