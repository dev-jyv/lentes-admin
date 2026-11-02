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

const LENS_LABEL: Record<string, string> = {
  spherical: 'Esférico', toric: 'Tórico', multifocal: 'Multifocal', cosmetic: 'Cosmético',
};
const REPL_LABEL: Record<string, string> = {
  daily: 'Diario', biweekly: 'Quincenal', monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual',
};

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
  imports: [FormField, RouterLink],
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl">Productos</h1>
      <button type="button" class="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" (click)="startCreate()">Nuevo producto</button>
    </div>

    @if (editing()) {
      <section class="mb-8 max-w-3xl rounded-lg border border-border p-4" aria-labelledby="form-title">
        <h2 id="form-title" class="mb-3 font-medium">{{ editingId() ? 'Editar producto' : 'Nuevo producto' }}</h2>
        <form class="grid gap-3 sm:grid-cols-2" (submit)="save($event)">
          <div class="sm:col-span-2">
            <label for="category" class="mb-1 block text-sm">Categoría</label>
            <select id="category" class="w-full rounded-lg border border-input px-3 py-2 disabled:opacity-60" [formField]="model.category">
              @for (o of categories; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
            @if (editingId()) { <p class="mt-1 text-xs text-muted-foreground">La categoría no se puede cambiar después de crear el producto.</p> }
          </div>
          <div>
            <label for="brand" class="mb-1 block text-sm">Marca</label>
            <select id="brand" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.brand_id">
              <option value="">Elegir…</option>
              @for (b of brands(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
            </select>
          </div>
          <div>
            <label for="pname" class="mb-1 block text-sm">Nombre</label>
            <input id="pname" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.name" (input)="autoSlug()" />
          </div>
          <div>
            <label for="pslug" class="mb-1 block text-sm">Slug (URL)</label>
            <input id="pslug" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.slug" />
          </div>
          @if (isFrame()) {
            <div>
              <label for="shape" class="mb-1 block text-sm">Forma</label>
              <select id="shape" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.shape">
                @for (o of shapes; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="fmaterial" class="mb-1 block text-sm">Material del armazón</label>
              <select id="fmaterial" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.frame_material">
                @for (o of frameMaterials; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="rim" class="mb-1 block text-sm">Aro</label>
              <select id="rim" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.rim">
                @for (o of rims; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="gender" class="mb-1 block text-sm">Para quién</label>
              <select id="gender" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.gender">
                @for (o of genders; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
            <div>
              <label for="lwidth" class="mb-1 block text-sm">Ancho de lente (mm)</label>
              <input id="lwidth" type="number" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.lens_width_mm" />
            </div>
            <div>
              <label for="bridge" class="mb-1 block text-sm">Puente (mm)</label>
              <input id="bridge" type="number" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.bridge_mm" />
            </div>
            <div>
              <label for="temple" class="mb-1 block text-sm">Varilla (mm)</label>
              <input id="temple" type="number" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.temple_mm" />
            </div>
          } @else {
          <div>
            <label for="lens" class="mb-1 block text-sm">Tipo de lente</label>
            <select id="lens" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.lens_type">
              @for (o of lensTypes; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="repl" class="mb-1 block text-sm">Reemplazo</label>
            <select id="repl" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.replacement">
              @for (o of replacements; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="pieces" class="mb-1 block text-sm">Piezas por caja</label>
            <input id="pieces" type="number" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.pieces_per_box" />
          </div>
          <div>
            <label for="material" class="mb-1 block text-sm">Material</label>
            <input id="material" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.material" />
          </div>
          <div>
            <label for="water" class="mb-1 block text-sm">Contenido de agua (%)</label>
            <input id="water" type="number" step="0.1" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.water_content_pct" />
          </div>
          }
          <div class="sm:col-span-2">
            <label for="desc" class="mb-1 block text-sm">Descripción</label>
            <textarea id="desc" rows="3" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.description"></textarea>
          </div>
          @if (!isFrame()) {
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" [formField]="model.requires_prescription" /> Requiere receta</label>
          }
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" [formField]="model.active" /> Activo (visible en la tienda)</label>
          @if (error()) { <p role="alert" class="text-sm text-destructive sm:col-span-2">{{ error() }}</p> }
          <div class="flex gap-2 sm:col-span-2">
            <button type="submit" class="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" [disabled]="busy()">Guardar</button>
            <button type="button" class="rounded-lg border border-input px-3 py-2" (click)="editing.set(false)">Cancelar</button>
          </div>
        </form>
      </section>
    }

    @if (loadError()) { <p role="alert" class="mb-4 text-sm text-destructive">{{ loadError() }}</p> }
    <div class="mb-4 max-w-xs">
      <label for="catfilter" class="mb-1 block text-sm">Filtrar por categoría</label>
      <select id="catfilter" class="w-full rounded-lg border border-input px-3 py-2 text-sm" (change)="filterCategory($event)">
        <option value="">Todas</option>
        @for (o of categories; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
      </select>
    </div>
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left"><th class="py-2">Producto</th><th>Categoría</th><th>Tipo</th><th>Reemplazo</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        @for (p of products(); track p.id) {
          <tr class="border-b">
            <td class="py-2"><span class="text-muted-foreground">{{ p.brand.name }}</span> {{ p.name }}</td>
            <td>{{ categoryLabel[p.category] }}</td>
            <td>{{ p.frame ? shapeLabel[p.frame.shape] : lensLabel(p.lens_type) }}</td>
            <td>{{ replLabel(p.replacement) }}</td>
            <td>{{ p.active ? 'Activo' : 'Inactivo' }}</td>
            <td class="space-x-3 text-right">
              <a class="underline" [routerLink]="['/productos', p.id, 'variantes']" [queryParams]="{ categoria: p.category }">Variantes</a>
              <a class="underline" [routerLink]="['/productos', p.id, 'imagenes']">Imágenes</a>
              <button type="button" class="underline" (click)="startEdit(p)">Editar</button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="6" class="py-4 text-muted-foreground">Aún no hay productos.</td></tr>
        }
      </tbody>
    </table>
    @if (nextCursor()) {
      <button type="button" class="mt-4 rounded-lg border border-input px-3 py-2 text-sm" (click)="load(true)">Cargar más</button>
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
      this.loadError.set(problemMessage(e, 'No se pudieron cargar los productos.'));
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
      this.loadError.set(problemMessage(e, 'No se pudieron cargar los productos.'));
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
    if (this.model().invalid()) return this.error.set('Revisa los campos obligatorios.');
    const s = this.state();
    const common = {
      category: s.category, brand_id: s.brand_id, name: s.name.trim(), slug: s.slug.trim(),
      description: s.description.trim() || null, active: s.active,
    };
    let body: ProductInput;
    if (s.category === ProductCategory.frame) {
      if (s.lens_width_mm == null || s.bridge_mm == null || s.temple_mm == null) {
        return this.error.set('Captura las tres medidas del armazón.');
      }
      body = {
        ...common, requires_prescription: false,
        frame: {
          shape: s.shape, material: s.frame_material, rim: s.rim, gender: s.gender,
          lens_width_mm: s.lens_width_mm, bridge_mm: s.bridge_mm, temple_mm: s.temple_mm,
        },
      };
    } else {
      if (s.pieces_per_box < 1) return this.error.set('Las piezas por caja deben ser al menos 1.');
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
      this.error.set(problemMessage(e, 'No se pudo guardar el producto (¿slug repetido?).'));
    } finally {
      this.busy.set(false);
    }
  }
}
