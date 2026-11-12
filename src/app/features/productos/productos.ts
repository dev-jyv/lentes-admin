import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import { ProductCategory } from '../../api/generated/model';
import type { AdminProduct, Brand } from '../../api/generated/model';
import { CatalogStore } from '../../core/catalogs';
import { CATEGORY_LABEL, toOptions } from '../../core/frame-labels';
import { problemMessage } from '../../core/problem';
import {
  emptyProductForm, productBody, productFormFrom, productFormSchema, progressiveEligible, WARRANTY,
} from '../../core/product-form';
import { slugify } from '../../core/slug';
import { t, TPipe } from '../../core/i18n';

@Component({
  selector: 'app-productos',
  imports: [FormField, RouterLink, TPipe],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="page-title">{{ 'nav.productos' | t }}</h1>
      <button type="button" class="btn btn-primary" (click)="startCreate()">{{ 'productos.new' | t }}</button>
    </div>

    @if (editing()) {
      <section class="panel mb-8 max-w-3xl p-5 shadow-[0_4px_16px_rgb(14_34_48/0.08)]" aria-labelledby="form-title">
        <h2 id="form-title" class="mb-3 text-lg">{{ editingId() ? ('productos.edit' | t) : ('productos.new' | t) }}</h2>
        <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
          <div class="sm:col-span-2">
            <label for="category" class="field-label">{{ 'productos.category' | t }}</label>
            <select id="category" class="field w-full" [formField]="model.category">
              @for (o of categories; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
            @if (editingId()) { <p class="mt-1 text-xs text-muted-foreground">{{ 'productos.categoryLocked' | t }}</p> }
          </div>
          <div>
            <label for="brand" class="field-label">{{ 'productos.brand' | t }}</label>
            <select id="brand" class="field w-full" [formField]="model.brand_id">
              <option value="">{{ 'common.choose' | t }}</option>
              @for (b of brands(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
            </select>
          </div>
          <div>
            <label for="pname" class="field-label">{{ 'common.name' | t }}</label>
            <input id="pname" class="field w-full" [formField]="model.name" (input)="autoSlug()" />
          </div>
          <div>
            <label for="pslug" class="field-label">{{ 'marcas.slugUrl' | t }}</label>
            <input id="pslug" class="field w-full" [formField]="model.slug" />
          </div>
          @if (isFrame()) {
            <div>
              <label for="shape" class="field-label">{{ 'productos.shape' | t }}</label>
              <select id="shape" class="field w-full" [formField]="model.shape">
                @for (o of shapes(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="fmaterial" class="field-label">{{ 'productos.frameMaterial' | t }}</label>
              <select id="fmaterial" class="field w-full" [formField]="model.frame_material">
                @for (o of frameMaterials(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="rim" class="field-label">{{ 'productos.rim' | t }}</label>
              <select id="rim" class="field w-full" [formField]="model.rim">
                @for (o of rims(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="gender" class="field-label">{{ 'productos.gender' | t }}</label>
              <select id="gender" class="field w-full" [formField]="model.gender">
                @for (o of genders(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="lwidth" class="field-label">{{ 'productos.lensWidth' | t }}</label>
              <input id="lwidth" type="number" class="field w-full" [formField]="model.lens_width_mm" />
            </div>
            <div>
              <label for="bridge" class="field-label">{{ 'productos.bridge' | t }}</label>
              <input id="bridge" type="number" class="field w-full" [formField]="model.bridge_mm" />
            </div>
            <div>
              <label for="temple" class="field-label">{{ 'productos.temple' | t }}</label>
              <input id="temple" type="number" class="field w-full" [formField]="model.temple_mm" />
            </div>
            <div>
              <label for="lheight" class="field-label">{{ 'productos.lensHeight' | t }}</label>
              <input id="lheight" type="number" class="field w-full" [formField]="model.lens_height_mm" aria-describedby="progressive" />
              <p id="progressive" class="mt-1 text-xs text-muted-foreground" aria-live="polite">
                {{ 'productos.progressive' | t }}: {{ progressiveText() }}
              </p>
            </div>
            <div>
              <label for="fwidth" class="field-label">{{ 'productos.frameWidth' | t }}</label>
              <input id="fwidth" type="number" class="field w-full" [formField]="model.frame_width_mm" />
            </div>
            <div>
              <label for="weight" class="field-label">{{ 'productos.weight' | t }}</label>
              <input id="weight" type="number" class="field w-full" [formField]="model.weight_g" />
            </div>
            <div>
              <label for="fsize" class="field-label">{{ 'productos.size' | t }}</label>
              <select id="fsize" class="field w-full" [formField]="model.size">
                <option value="">{{ 'productos.unknown' | t }}</option>
                @for (o of sizes(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="hinges" class="field-label">{{ 'productos.springHinges' | t }}</label>
              <select id="hinges" class="field w-full" [formField]="model.spring_hinges">
                @for (o of tri; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="pads" class="field-label">{{ 'productos.nosePads' | t }}</label>
              <select id="pads" class="field w-full" [formField]="model.adjustable_nose_pads">
                @for (o of tri; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <fieldset class="sm:col-span-2">
              <legend class="field-label">{{ 'productos.includes' | t }}</legend>
              <div class="grid gap-2 sm:grid-cols-2">
                @for (o of includes(); track o.value) {
                  <label class="flex items-center gap-2 text-sm"><input type="checkbox" [formField]="model.includes[o.value]" /> {{ o.label }}</label>
                }
              </div>
            </fieldset>
            <div>
              <label for="warranty" class="field-label">{{ 'productos.warrantyMonths' | t }}</label>
              <input id="warranty" type="number" class="field w-full" [formField]="model.warranty_months"
                [attr.aria-describedby]="hasWarranty() ? null : 'warranty-hint'" />
              @if (!hasWarranty()) {
                <p id="warranty-hint" class="mt-1 text-xs text-muted-foreground">{{ 'productos.warrantyHint' | t }}</p>
              }
            </div>
          } @else {
          <div>
            <label for="lens" class="field-label">{{ 'productos.lensType' | t }}</label>
            <select id="lens" class="field w-full" [formField]="model.lens_type">
              @for (o of lensTypes(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="repl" class="field-label">{{ 'productos.replacement' | t }}</label>
            <select id="repl" class="field w-full" [formField]="model.replacement">
              @for (o of replacements(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="pieces" class="field-label">{{ 'productos.pieces' | t }}</label>
            <input id="pieces" type="number" class="field w-full" [formField]="model.pieces_per_box" />
          </div>
          <div>
            <label for="material" class="field-label">{{ 'productos.material' | t }}</label>
            <input id="material" class="field w-full" [formField]="model.material" />
          </div>
          <div>
            <label for="water" class="field-label">{{ 'productos.water' | t }}</label>
            <input id="water" type="number" step="0.1" class="field w-full" [formField]="model.water_content_pct" />
          </div>
          <div>
            <label for="manufacturer" class="field-label">{{ 'productos.manufacturer' | t }}</label>
            <input id="manufacturer" class="field w-full" [formField]="model.manufacturer" />
          </div>
          <div>
            <label for="uv" class="field-label">{{ 'productos.uvBlocking' | t }}</label>
            <select id="uv" class="field w-full" [formField]="model.uv_blocking">
              @for (o of tri; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="tint" class="field-label">{{ 'productos.visibilityTint' | t }}</label>
            <select id="tint" class="field w-full" [formField]="model.visibility_tint">
              @for (o of tri; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div class="sm:col-span-2">
            <label for="pnote" class="field-label">{{ 'productos.packageNote' | t }}</label>
            <input id="pnote" class="field w-full" [formField]="model.package_note" />
          </div>
          }
          <div class="sm:col-span-2">
            <label for="desc" class="field-label">{{ 'common.description' | t }}</label>
            <textarea id="desc" rows="3" class="field w-full" [formField]="model.description"></textarea>
          </div>
          @if (!isFrame()) {
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" [formField]="model.requires_prescription" /> {{ 'productos.requiresPrescription' | t }}</label>
          }
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" [formField]="model.active" /> {{ 'productos.activeVisible' | t }}</label>
          @if (error()) { <p role="alert" class="alert-error sm:col-span-2">{{ error() }}</p> }
          <div class="flex flex-wrap gap-2 border-t border-border pt-4 sm:col-span-2">
            <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ 'common.save' | t }}</button>
            <button type="button" class="btn btn-secondary" (click)="editing.set(false)">{{ 'common.cancel' | t }}</button>
          </div>
        </form>
      </section>
    }

    @if (loadError()) { <p role="alert" class="alert-error mb-4">{{ loadError() }}</p> }
    <div class="mb-4 flex items-center gap-3">
      <label for="catfilter" class="text-sm font-medium">{{ 'productos.filter' | t }}</label>
      <select id="catfilter" class="field" (change)="filterCategory($event)">
        <option value="">{{ 'productos.allCategories' | t }}</option>
        @for (o of categories; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
      </select>
    </div>
    <div class="panel overflow-x-auto">
      <table class="data-table stack">
        <thead>
          <tr>
            <th scope="col">{{ 'common.product' | t }}</th>
            <th scope="col">{{ 'productos.category' | t }}</th>
            <th scope="col">{{ 'common.type' | t }}</th>
            <th scope="col">{{ 'productos.replacement' | t }}</th>
            <th scope="col">{{ 'common.status' | t }}</th>
            <th scope="col"><span class="sr-only">{{ 'common.edit' | t }}</span></th>
          </tr>
        </thead>
        <tbody>
          @for (p of products(); track p.id) {
            <tr>
              <td>{{ p.name }} <span class="font-normal text-muted-foreground">· {{ p.brand.name }}</span></td>
              <td [attr.data-label]="'productos.category' | t">{{ categoryLabel[p.category] }}</td>
              <td [attr.data-label]="'common.type' | t">{{ p.frame ? catalogs.label('frame_shape', p.frame.shape) : catalogs.label('lens_type', p.lens_type) }}</td>
              <td [attr.data-label]="'productos.replacement' | t">{{ catalogs.label('replacement', p.replacement) }}</td>
              <td [attr.data-label]="'common.status' | t">
                <span class="pill"><span class="size-1.5 rounded-full" [class]="p.active ? 'bg-good' : 'bg-muted-foreground'" aria-hidden="true"></span>{{ p.active ? ('common.active' | t) : ('common.inactive' | t) }}</span>
              </td>
              <td class="actions">
                <a class="link" [routerLink]="['/productos', p.id, 'variantes']" [queryParams]="{ categoria: p.category }">{{ 'inventario.variants' | t }}</a>
                <a class="link" [routerLink]="['/productos', p.id, 'imagenes']">{{ 'productos.images' | t }}</a>
                <button type="button" class="link" (click)="startEdit(p)">{{ 'common.edit' | t }}</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="empty">{{ 'productos.empty' | t }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    @if (nextCursor()) {
      <div class="mt-4 flex justify-center"><button type="button" class="btn btn-secondary" (click)="load(true)">{{ 'common.loadMore' | t }}</button></div>
    }
  `,
})
export default class Productos implements OnInit {
  private readonly api = inject(DefaultService);
  protected readonly products = signal<AdminProduct[]>([]);
  protected readonly brands = signal<Brand[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);

  protected readonly catalogs = inject(CatalogStore);
  /** Producto en edición tal como llegó: sus valores ocultos se siguen ofreciendo, marcados "(oculto)". */
  private readonly original = signal<AdminProduct | null>(null);
  protected readonly lensTypes = computed(() => this.catalogs.options('lens_type', this.original()?.lens_type));
  protected readonly replacements = computed(() => this.catalogs.options('replacement', this.original()?.replacement));
  protected readonly categories = toOptions(CATEGORY_LABEL);
  protected readonly shapes = computed(() => this.catalogs.options('frame_shape', this.original()?.frame?.shape));
  protected readonly frameMaterials = computed(() => this.catalogs.options('frame_material', this.original()?.frame?.material));
  protected readonly rims = computed(() => this.catalogs.options('frame_rim', this.original()?.frame?.rim));
  protected readonly genders = computed(() => this.catalogs.options('frame_gender', this.original()?.frame?.gender));
  protected readonly sizes = computed(() => this.catalogs.options('frame_size', this.original()?.frame?.size));
  // Solo las casillas que el formulario tiene (se arma con el catálogo al abrirlo).
  protected readonly includes = computed(() =>
    this.catalogs.options('frame_include', this.original()?.frame?.includes ?? []).filter((o) => o.value in this.state().includes),
  );
  protected readonly tri = [
    { value: '', label: t('productos.unknown') },
    { value: 'yes', label: t('productos.yes') },
    { value: 'no', label: t('productos.no') },
  ];
  protected readonly categoryLabel = CATEGORY_LABEL;
  private readonly category = signal<ProductCategory | null>(null);

  protected readonly state = signal(emptyProductForm());
  protected readonly model = form(this.state, productFormSchema(() => this.editingId() !== null));
  protected readonly isFrame = computed(() => this.state().category === ProductCategory.frame);
  protected readonly hasWarranty = computed(() => this.state().includes[WARRANTY] === true);
  protected readonly progressiveText = computed(() => {
    const ok = progressiveEligible(this.state().lens_height_mm);
    return ok == null ? '—' : t(ok ? 'productos.yes' : 'productos.no');
  });
  private slugTouched = false;

  async ngOnInit() {
    try {
      const [brands, catalogs] = await Promise.all([firstValueFrom(this.api.listBrands()), this.catalogs.load(), this.load(false)]);
      this.brands.set(brands.items);
      // Sin catálogo no hay opciones de forma, color, tipo de lente…: se avisa en lugar de ofrecer un formulario vacío.
      if (!catalogs) this.loadError.set(this.catalogs.error());
    } catch (e) {
      this.loadError.set(problemMessage(e, t('productos.loadFailed')));
    }
  }

  protected async load(more: boolean) {
    const res = await firstValueFrom(
      this.api.adminListProducts({
        limit: 50,
        ...(this.category() ? { category: this.category()! } : {}),
        ...(more && this.nextCursor() ? { cursor: this.nextCursor()! } : {}),
      }),
    ).catch((e: unknown) => {
      this.loadError.set(problemMessage(e, t('productos.loadFailed')));
      return null;
    });
    if (!res) return;
    this.products.update((list) => (more ? [...list, ...res.items] : res.items));
    this.nextCursor.set(res.next_cursor ?? null);
  }

  protected filterCategory(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.category.set((value || null) as ProductCategory | null);
    return this.load(false);
  }

  protected startCreate() {
    this.slugTouched = false;
    this.editingId.set(null);
    this.original.set(null);
    this.state.set(emptyProductForm(this.catalogs.catalogs()));
    this.error.set(null);
    this.editing.set(true);
  }

  protected startEdit(p: AdminProduct) {
    this.slugTouched = true;
    this.editingId.set(p.id);
    this.original.set(p);
    this.state.set(productFormFrom(p, this.catalogs.catalogs()));
    this.error.set(null);
    this.editing.set(true);
  }

  protected autoSlug() {
    if (!this.slugTouched && !this.editingId()) this.state.update((s) => ({ ...s, slug: slugify(s.name) }));
  }

  protected async save(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return this.error.set(t('common.checkRequired'));
    const body = productBody(this.state());
    if (typeof body === 'string') return this.error.set(body);
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      const saved = await firstValueFrom(id ? this.api.adminUpdateProduct(id, body) : this.api.adminCreateProduct(body));
      this.products.update((list) =>
        id ? list.map((p) => (p.id === id ? saved : p)) : [saved, ...list],
      );
      this.editing.set(false);
    } catch (e) {
      this.error.set(problemMessage(e, t('productos.saveFailed')));
    } finally {
      this.busy.set(false);
    }
  }
}
