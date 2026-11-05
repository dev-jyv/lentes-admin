import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import { FrameGender, FrameMaterial, FrameRim, FrameShape, LensType, ProductCategory, Replacement } from '../../api/generated/model';
import type { AdminProduct, Brand, ProductInput } from '../../api/generated/model';
import { CATEGORY_LABEL, GENDER_LABEL, MATERIAL_LABEL, RIM_LABEL, SHAPE_LABEL, toOptions } from '../../core/frame-labels';
import { problemMessage } from '../../core/problem';
import { slugify } from '../../core/slug';
import { t, TPipe } from '../../core/i18n';

const LENS_LABEL: Record<string, string> = t('labels.lensType', { returnObjects: true });
const REPL_LABEL: Record<string, string> = t('labels.replacement', { returnObjects: true });

interface ProductForm {
  category: ProductCategory;
  shape: FrameShape;
  frame_material: FrameMaterial;
  rim: FrameRim;
  gender: FrameGender;
  lens_width_mm: number | null;
  bridge_mm: number | null;
  temple_mm: number | null;
  brand_id: string;
  name: string;
  slug: string;
  description: string;
  lens_type: string;
  replacement: string;
  pieces_per_box: number;
  material: string;
  water_content_pct: number | null;
  requires_prescription: boolean;
  active: boolean;
}

const empty = (): ProductForm => ({
  category: ProductCategory.contact_lens,
  shape: FrameShape.rectangular, frame_material: FrameMaterial.acetate, rim: FrameRim.full, gender: FrameGender.unisex,
  lens_width_mm: null, bridge_mm: null, temple_mm: null,
  brand_id: '', name: '', slug: '', description: '', lens_type: LensType.spherical,
  replacement: Replacement.monthly, pieces_per_box: 6, material: '', water_content_pct: null,
  requires_prescription: true, active: true,
});

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
                @for (o of shapes; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="fmaterial" class="field-label">{{ 'productos.frameMaterial' | t }}</label>
              <select id="fmaterial" class="field w-full" [formField]="model.frame_material">
                @for (o of frameMaterials; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="rim" class="field-label">{{ 'productos.rim' | t }}</label>
              <select id="rim" class="field w-full" [formField]="model.rim">
                @for (o of rims; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="gender" class="field-label">{{ 'productos.gender' | t }}</label>
              <select id="gender" class="field w-full" [formField]="model.gender">
                @for (o of genders; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
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
          } @else {
          <div>
            <label for="lens" class="field-label">{{ 'productos.lensType' | t }}</label>
            <select id="lens" class="field w-full" [formField]="model.lens_type">
              @for (o of lensTypes; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="repl" class="field-label">{{ 'productos.replacement' | t }}</label>
            <select id="repl" class="field w-full" [formField]="model.replacement">
              @for (o of replacements; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
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
              <td [attr.data-label]="'common.type' | t">{{ p.frame ? shapeLabel[p.frame.shape] : lensLabel(p.lens_type) }}</td>
              <td [attr.data-label]="'productos.replacement' | t">{{ replLabel(p.replacement) }}</td>
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

  protected readonly lensTypes = Object.values(LensType).map((v) => ({ value: v, label: LENS_LABEL[v] ?? v }));
  protected readonly replacements = Object.values(Replacement).map((v) => ({ value: v, label: REPL_LABEL[v] ?? v }));
  protected readonly categories = toOptions(CATEGORY_LABEL);
  protected readonly shapes = toOptions(SHAPE_LABEL);
  protected readonly frameMaterials = toOptions(MATERIAL_LABEL);
  protected readonly rims = toOptions(RIM_LABEL);
  protected readonly genders = toOptions(GENDER_LABEL);
  protected readonly categoryLabel = CATEGORY_LABEL;
  protected readonly shapeLabel = SHAPE_LABEL;
  protected lensLabel = (v: string | null) => (v ? (LENS_LABEL[v] ?? v) : '—');
  protected replLabel = (v: string | null) => (v ? (REPL_LABEL[v] ?? v) : '—');
  private readonly category = signal<ProductCategory | null>(null);

  private readonly state = signal<ProductForm>(empty());
  protected readonly model = form(this.state, (f) => {
    required(f.brand_id);
    required(f.name);
    required(f.slug);
    disabled(f.category, () => this.editingId() !== null);
  });
  protected readonly isFrame = computed(() => this.state().category === ProductCategory.frame);
  private slugTouched = false;

  async ngOnInit() {
    try {
      const [brands] = await Promise.all([firstValueFrom(this.api.listBrands()), this.load(false)]);
      this.brands.set(brands.items);
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
    this.state.set(empty());
    this.error.set(null);
    this.editing.set(true);
  }

  protected startEdit(p: AdminProduct) {
    this.slugTouched = true;
    this.editingId.set(p.id);
    this.state.set({
      ...empty(),
      category: p.category,
      ...(p.frame
        ? {
            shape: p.frame.shape, frame_material: p.frame.material, rim: p.frame.rim, gender: p.frame.gender,
            lens_width_mm: p.frame.lens_width_mm, bridge_mm: p.frame.bridge_mm, temple_mm: p.frame.temple_mm,
          }
        : {}),
      brand_id: p.brand.id, name: p.name, slug: p.slug, description: p.description ?? '',
      lens_type: p.lens_type ?? LensType.spherical, replacement: p.replacement ?? Replacement.monthly,
      pieces_per_box: p.pieces_per_box ?? 6,
      material: p.material ?? '', water_content_pct: p.water_content_pct ?? null,
      requires_prescription: p.requires_prescription, active: p.active,
    });
    this.error.set(null);
    this.editing.set(true);
  }

  protected autoSlug() {
    if (!this.slugTouched && !this.editingId()) this.state.update((s) => ({ ...s, slug: slugify(s.name) }));
  }

  protected async save(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return this.error.set(t('common.checkRequired'));
    const s = this.state();
    const common = {
      category: s.category, brand_id: s.brand_id, name: s.name.trim(), slug: s.slug.trim(),
      description: s.description.trim() || null, active: s.active,
    };
    let body: ProductInput;
    if (s.category === ProductCategory.frame) {
      if (s.lens_width_mm == null || s.bridge_mm == null || s.temple_mm == null) {
        return this.error.set(t('productos.measuresRequired'));
      }
      body = {
        ...common, requires_prescription: false,
        frame: {
          shape: s.shape, material: s.frame_material, rim: s.rim, gender: s.gender,
          lens_width_mm: s.lens_width_mm, bridge_mm: s.bridge_mm, temple_mm: s.temple_mm,
        },
      };
    } else {
      if (s.pieces_per_box < 1) return this.error.set(t('productos.piecesMin'));
      body = {
        ...common,
        lens_type: s.lens_type as ProductInput['lens_type'],
        replacement: s.replacement as ProductInput['replacement'],
        pieces_per_box: s.pieces_per_box, material: s.material.trim() || null,
        water_content_pct: s.water_content_pct,
        requires_prescription: s.requires_prescription,
      };
    }
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
