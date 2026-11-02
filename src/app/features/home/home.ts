import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import { BannerPlacement, ProductCategory } from '../../api/generated/model';
import type { AdminHomeBanner, AdminProduct, HomeBannerInput, Product } from '../../api/generated/model';
import { bannerStatus, shownBannerIds } from '../../core/banner-status';
import { cdmxInputToUtc, utcToCdmxInput } from '../../core/cdmx-time';
import { CATEGORY_LABEL, toOptions } from '../../core/frame-labels';
import { IMAGE_TYPES, ImageType, move, validateImage } from '../../core/images';
import { problemMessage } from '../../core/problem';

const PLACEMENT_LABEL: Record<BannerPlacement, string> = {
  promo_bar: 'Barra promocional',
  hero: 'Banner principal',
  secondary: 'Banners secundarios',
};

const MAX_FEATURED = 8;

interface BannerForm {
  placement: BannerPlacement;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  image_alt: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

const empty = (placement: BannerPlacement = BannerPlacement.promo_bar): BannerForm => ({
  placement, title: '', subtitle: '', cta_label: '', cta_href: '', image_alt: '', starts_at: '', ends_at: '', active: true,
});

type FeaturedItem = Pick<Product, 'id' | 'name' | 'brand'> & { active?: boolean; from_price_cents?: number | null };

@Component({
  selector: 'app-home-content',
  imports: [FormField],
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl">Home</h1>
      <button type="button" class="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" (click)="startCreate()">Nuevo banner</button>
    </div>

    @if (editing()) {
      <section class="mb-8 max-w-3xl rounded-lg border border-border p-4" aria-labelledby="btitle">
        <h2 id="btitle" class="mb-1 font-medium">{{ editingId() ? 'Editar banner' : 'Nuevo banner' }}</h2>
        <p class="mb-3 text-sm text-muted-foreground">Publica solo promociones que la tienda pueda cumplir: el sistema no las valida.</p>
        <form class="grid gap-3 sm:grid-cols-2" (submit)="save($event)">
          <div>
            <label for="placement" class="mb-1 block text-sm">Ubicación</label>
            <select id="placement" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.placement">
              @for (o of placements; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="title" class="mb-1 block text-sm">Título {{ isPromo() ? '(máx. 90)' : '(máx. 120)' }}</label>
            <input id="title" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.title" />
          </div>
          @if (!isPromo()) {
            <div class="sm:col-span-2">
              <label for="subtitle" class="mb-1 block text-sm">Subtítulo (opcional)</label>
              <input id="subtitle" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.subtitle" />
            </div>
          }
          <div>
            <label for="cta" class="mb-1 block text-sm">Texto del enlace{{ isPromo() ? ' (opcional)' : '' }}</label>
            <input id="cta" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.cta_label" />
          </div>
          <div>
            <label for="href" class="mb-1 block text-sm">Ruta interna{{ isPromo() ? ' (opcional)' : '' }}</label>
            <input id="href" class="w-full rounded-lg border border-input px-3 py-2" placeholder="/armazones" [formField]="model.cta_href" />
          </div>
          @if (!isPromo()) {
            <div>
              <label for="img" class="mb-1 block text-sm">Imagen (JPG, PNG o WebP, máx. 5 MB)</label>
              <input id="img" type="file" [accept]="accept" class="block text-sm" (change)="upload($event)" [disabled]="uploading()" />
              @if (preview()) { <img [src]="preview()" alt="Vista previa del banner" class="mt-2 h-24 rounded-lg object-cover" /> }
            </div>
            <div>
              <label for="alt" class="mb-1 block text-sm">Descripción de la imagen</label>
              <input id="alt" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.image_alt" />
            </div>
          }
          <div>
            <label for="starts" class="mb-1 block text-sm">Inicia (hora de la Ciudad de México)</label>
            <input id="starts" type="datetime-local" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.starts_at" />
          </div>
          <div>
            <label for="ends" class="mb-1 block text-sm">Termina (hora de la Ciudad de México)</label>
            <input id="ends" type="datetime-local" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.ends_at" />
          </div>
          <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" [formField]="model.active" /> Activo</label>
          @if (error()) { <p role="alert" class="text-sm text-destructive sm:col-span-2">{{ error() }}</p> }
          <div class="flex gap-2 sm:col-span-2">
            <button type="submit" class="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" [disabled]="busy() || uploading()">Guardar</button>
            <button type="button" class="rounded-lg border border-input px-3 py-2" (click)="editing.set(false)">Cancelar</button>
          </div>
        </form>
      </section>
    }

    @if (loadError()) { <p role="alert" class="mb-4 text-sm text-destructive">{{ loadError() }}</p> }

    @for (group of groups(); track group.value) {
      <section class="mb-8" [attr.aria-labelledby]="'g-' + group.value">
        <h2 [id]="'g-' + group.value" class="mb-2 font-medium">{{ group.label }}</h2>
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left"><th class="py-2">Título</th><th>Estado</th><th>Vigencia (CDMX)</th><th></th></tr></thead>
          <tbody>
            @for (b of group.items; track b.id; let i = $index) {
              <tr class="border-b">
                <td class="py-2">{{ b.title }}</td>
                <td>{{ status(b) }} @if (shown().has(b.id)) { <span class="text-xs font-semibold text-primary">· se muestra</span> }</td>
                <td>{{ range(b) }}</td>
                <td class="space-x-3 text-right">
                  <button type="button" class="underline disabled:opacity-40" [attr.aria-label]="'Subir ' + b.title" [disabled]="i === 0" (click)="shift(group.value, i, -1)">↑</button>
                  <button type="button" class="underline disabled:opacity-40" [attr.aria-label]="'Bajar ' + b.title" [disabled]="i === group.items.length - 1" (click)="shift(group.value, i, 1)">↓</button>
                  <button type="button" class="underline" (click)="startEdit(b)">Editar</button>
                  <button type="button" class="underline" (click)="remove(b)">Borrar</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="py-4 text-muted-foreground">Sin banners.</td></tr>
            }
          </tbody>
        </table>
      </section>
    }

    <section class="max-w-3xl" aria-labelledby="ftitle">
      <h2 id="ftitle" class="mb-1 font-medium">Productos destacados</h2>
      <p class="mb-3 text-sm text-muted-foreground">Hasta {{ maxFeatured }} por categoría. Los inactivos o agotados se conservan, pero la tienda no los muestra.</p>
      <div class="mb-3 max-w-xs">
        <label for="fcat" class="mb-1 block text-sm">Categoría</label>
        <select id="fcat" class="w-full rounded-lg border border-input px-3 py-2 text-sm" (change)="pickCategory($event)">
          @for (o of categories; track o.value) { <option [value]="o.value" [selected]="o.value === category()">{{ o.label }}</option> }
        </select>
      </div>
      <ol class="mb-4 space-y-1 text-sm">
        @for (p of featured(); track p.id; let i = $index) {
          <li class="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span>{{ i + 1 }}. <span class="text-muted-foreground">{{ p.brand.name }}</span> {{ p.name }}
              @if (hidden(p)) { <span class="text-xs text-destructive">· no se muestra</span> }
            </span>
            <span class="space-x-3">
              <button type="button" class="underline disabled:opacity-40" [attr.aria-label]="'Subir ' + p.name" [disabled]="i === 0" (click)="shiftFeatured(i, -1)">↑</button>
              <button type="button" class="underline disabled:opacity-40" [attr.aria-label]="'Bajar ' + p.name" [disabled]="i === featured().length - 1" (click)="shiftFeatured(i, 1)">↓</button>
              <button type="button" class="underline" (click)="removeFeatured(p.id)">Quitar</button>
            </span>
          </li>
        } @empty {
          <li class="text-muted-foreground">Sin destacados.</li>
        }
      </ol>
      <form class="mb-2 flex items-end gap-2" (submit)="search($event)">
        <div class="grow">
          <label for="fq" class="mb-1 block text-sm">Buscar producto</label>
          <input id="fq" class="w-full rounded-lg border border-input px-3 py-2 text-sm" [value]="query()" (input)="query.set($any($event.target).value)" />
        </div>
        <button type="submit" class="rounded-lg border border-input px-3 py-2 text-sm">Buscar</button>
      </form>
      @if (featuredError()) { <p role="alert" class="mb-2 text-sm text-destructive">{{ featuredError() }}</p> }
      <ul class="mb-4 space-y-1 text-sm">
        @for (p of results(); track p.id) {
          <li class="flex items-center justify-between border-b border-border py-1">
            <span><span class="text-muted-foreground">{{ p.brand.name }}</span> {{ p.name }}</span>
            <button type="button" class="underline disabled:opacity-40" [disabled]="isFeatured(p.id) || featured().length >= maxFeatured" (click)="addFeatured(p)">Agregar</button>
          </li>
        }
      </ul>
      <button type="button" class="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" [disabled]="busy()" (click)="saveFeatured()">Guardar destacados</button>
      @if (featuredOk()) { <p role="status" class="mt-2 text-sm">{{ featuredOk() }}</p> }
    </section>
  `,
})
export default class HomeContent implements OnInit {
  private readonly api = inject(DefaultService);
  private readonly http = inject(HttpClient);

  protected readonly banners = signal<AdminHomeBanner[]>([]);
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  private readonly imageKey = signal<string | null>(null);
  protected readonly preview = signal<string | null>(null);

  protected readonly accept = IMAGE_TYPES.join(',');
  protected readonly maxFeatured = MAX_FEATURED;
  protected readonly placements = toOptions(PLACEMENT_LABEL);
  protected readonly categories = toOptions(CATEGORY_LABEL);

  private readonly state = signal<BannerForm>(empty());
  protected readonly model = form(this.state, (f) => {
    required(f.title);
  });
  protected readonly isPromo = computed(() => this.state().placement === BannerPlacement.promo_bar);
  protected readonly shown = computed(() => shownBannerIds(this.banners()));
  protected readonly groups = computed(() =>
    this.placements.map((p) => ({
      ...p,
      items: this.banners().filter((b) => b.placement === p.value).sort((a, b) => a.position - b.position),
    })),
  );
  protected status = (b: AdminHomeBanner) => bannerStatus(b);
  protected range = (b: AdminHomeBanner) =>
    `${utcToCdmxInput(b.starts_at).replace('T', ' ') || 'Sin inicio'} → ${utcToCdmxInput(b.ends_at).replace('T', ' ') || 'Sin fin'}`;

  protected readonly category = signal<ProductCategory>(ProductCategory.frame);
  protected readonly featured = signal<FeaturedItem[]>([]);
  protected readonly results = signal<Product[]>([]);
  protected readonly query = signal('');
  protected readonly featuredError = signal<string | null>(null);
  protected readonly featuredOk = signal<string | null>(null);
  protected hidden = (p: FeaturedItem) => p.active === false || p.from_price_cents == null;
  protected isFeatured = (id: string) => this.featured().some((p) => p.id === id);

  async ngOnInit() {
    await Promise.all([this.loadBanners(), this.loadFeatured()]);
  }

  private async loadBanners() {
    try {
      this.banners.set((await firstValueFrom(this.api.adminListHomeBanners())).items);
    } catch (e) {
      this.loadError.set(problemMessage(e, 'No se pudieron cargar los banners.'));
    }
  }

  protected startCreate() {
    this.editingId.set(null);
    this.state.set(empty());
    this.imageKey.set(null);
    this.preview.set(null);
    this.error.set(null);
    this.editing.set(true);
  }

  protected startEdit(b: AdminHomeBanner) {
    this.editingId.set(b.id);
    this.state.set({
      placement: b.placement, title: b.title, subtitle: b.subtitle ?? '', cta_label: b.cta_label ?? '', cta_href: b.cta_href ?? '',
      image_alt: b.image_alt ?? '', starts_at: utcToCdmxInput(b.starts_at), ends_at: utcToCdmxInput(b.ends_at), active: b.active,
    });
    this.imageKey.set(b.image_key ?? null);
    this.preview.set(b.image_url ?? null);
    this.error.set(null);
    this.editing.set(true);
  }

  protected async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const invalid = validateImage(file);
    if (invalid) return this.error.set(invalid);
    this.uploading.set(true);
    this.error.set(null);
    try {
      // 1) URL prefirmada  2) PUT directo a R2 (sin Bearer: no empieza con /v1)
      const { upload_url, r2_key } = await firstValueFrom(
        this.api.adminCreateBannerImageUploadUrl({ content_type: file.type as ImageType, size_bytes: file.size }),
      );
      await firstValueFrom(this.http.put(upload_url, file, { headers: { 'Content-Type': file.type } }));
      this.imageKey.set(r2_key);
      this.preview.set(URL.createObjectURL(file));
    } catch (e) {
      this.error.set(problemMessage(e, 'No se pudo subir la imagen.'));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async save(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return this.error.set('Revisa los campos obligatorios.');
    const s = this.state();
    const promo = this.isPromo();
    const body: HomeBannerInput = {
      placement: s.placement, title: s.title.trim(), active: s.active,
      subtitle: promo ? null : s.subtitle.trim() || null,
      cta_label: s.cta_label.trim() || null,
      cta_href: s.cta_href.trim() || null,
      image_key: promo ? null : this.imageKey(),
      image_alt: promo ? null : s.image_alt.trim() || null,
      starts_at: cdmxInputToUtc(s.starts_at),
      ends_at: cdmxInputToUtc(s.ends_at),
    };
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      await firstValueFrom(id ? this.api.adminUpdateHomeBanner(id, body) : this.api.adminCreateHomeBanner(body));
      await this.loadBanners();
      this.editing.set(false);
    } catch (e) {
      this.error.set(problemMessage(e, 'No se pudo guardar el banner.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async shift(placement: BannerPlacement, index: number, dir: -1 | 1) {
    const items = this.groups().find((g) => g.value === placement)?.items ?? [];
    const ids = move(items, index, dir).map((b) => b.id);
    try {
      await firstValueFrom(this.api.adminReorderHomeBanners({ placement, banner_ids: ids }));
      await this.loadBanners();
    } catch (e) {
      this.loadError.set(problemMessage(e, 'No se pudo cambiar el orden.'));
    }
  }

  protected async remove(b: AdminHomeBanner) {
    if (!confirm(`¿Borrar el banner "${b.title}"?`)) return;
    try {
      await firstValueFrom(this.api.adminDeleteHomeBanner(b.id));
      await this.loadBanners();
    } catch (e) {
      this.loadError.set(problemMessage(e, 'No se pudo borrar el banner.'));
    }
  }

  private async loadFeatured() {
    try {
      const res = await firstValueFrom(this.api.adminListHomeFeatured({ category: this.category() }));
      this.featured.set(res.items as AdminProduct[]);
    } catch (e) {
      this.featuredError.set(problemMessage(e, 'No se pudieron cargar los destacados.'));
    }
  }

  protected pickCategory(event: Event) {
    this.category.set((event.target as HTMLSelectElement).value as ProductCategory);
    this.results.set([]);
    this.featuredOk.set(null);
    return this.loadFeatured();
  }

  protected async search(event: Event) {
    event.preventDefault();
    this.featuredError.set(null);
    try {
      const res = await firstValueFrom(this.api.listProducts({ category: this.category(), q: this.query().trim(), limit: 20 }));
      this.results.set(res.items);
    } catch (e) {
      this.featuredError.set(problemMessage(e, 'No se pudo buscar. Escribe al menos 2 caracteres.'));
    }
  }

  protected addFeatured(p: Product) {
    this.featuredOk.set(null);
    this.featured.update((list) => [...list, p]);
  }

  protected removeFeatured(id: string) {
    this.featuredOk.set(null);
    this.featured.update((list) => list.filter((p) => p.id !== id));
  }

  protected shiftFeatured(index: number, dir: -1 | 1) {
    this.featuredOk.set(null);
    this.featured.update((list) => move(list, index, dir));
  }

  protected async saveFeatured() {
    this.busy.set(true);
    this.featuredError.set(null);
    this.featuredOk.set(null);
    try {
      const res = await firstValueFrom(
        this.api.adminSetHomeFeatured({ category: this.category(), product_ids: this.featured().map((p) => p.id) }),
      );
      this.featured.set(res.items as AdminProduct[]);
      this.featuredOk.set('Destacados guardados. La tienda los muestra en menos de un minuto.');
    } catch (e) {
      this.featuredError.set(problemMessage(e, 'No se pudieron guardar los destacados.'));
    } finally {
      this.busy.set(false);
    }
  }
}
