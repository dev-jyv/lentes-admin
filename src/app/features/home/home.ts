import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import { BannerPlacement, ProductCategory } from '../../api/generated/model';
import type { AdminHomeBanner, AdminProduct, HomeBannerInput, Product } from '../../api/generated/model';
import { bannerStatus, shownBannerIds, type BannerStatus } from '../../core/banner-status';
import { cdmxInputToUtc, utcToCdmxInput } from '../../core/cdmx-time';
import { CATEGORY_LABEL, toOptions } from '../../core/frame-labels';
import { IMAGE_TYPES, ImageType, move, validateImage } from '../../core/images';
import { problemMessage } from '../../core/problem';
import { t, TPipe } from '../../core/i18n';

const PLACEMENT_LABEL: Record<BannerPlacement, string> = t('labels.placement', { returnObjects: true });

// El código del estado lo fija core/banner-status; aquí solo se traduce para mostrarlo.
const STATUS_LABEL: Record<BannerStatus, string> = {
  Vigente: t('labels.bannerStatus.current'),
  Programado: t('labels.bannerStatus.scheduled'),
  Vencido: t('labels.bannerStatus.expired'),
  Inactivo: t('labels.bannerStatus.inactive'),
};

const STATUS_DOT: Record<BannerStatus, string> = {
  Vigente: 'bg-good',
  Programado: 'bg-primary',
  Vencido: 'bg-muted-foreground',
  Inactivo: 'bg-muted-foreground',
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
  imports: [FormField, TPipe],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="page-title">{{ 'nav.home' | t }}</h1>
      <button type="button" class="btn btn-primary" (click)="startCreate()">{{ 'homeAdmin.newBanner' | t }}</button>
    </div>

    @if (editing()) {
      <section class="panel mb-8 max-w-3xl p-5 shadow-[0_4px_16px_rgb(14_34_48/0.08)]" aria-labelledby="btitle">
        <h2 id="btitle" class="mb-1 text-lg">{{ editingId() ? ('homeAdmin.editBanner' | t) : ('homeAdmin.newBanner' | t) }}</h2>
        <p class="mb-3 text-sm text-muted-foreground">{{ 'homeAdmin.honesty' | t }}</p>
        <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
          <div>
            <label for="placement" class="field-label">{{ 'homeAdmin.placement' | t }}</label>
            <select id="placement" class="field w-full" [formField]="model.placement">
              @for (o of placements; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="title" class="field-label">{{ isPromo() ? ('homeAdmin.titlePromo' | t) : ('homeAdmin.titleDefault' | t) }}</label>
            <input id="title" class="field w-full" [formField]="model.title" />
          </div>
          @if (!isPromo()) {
            <div class="sm:col-span-2">
              <label for="subtitle" class="field-label">{{ 'homeAdmin.subtitle' | t }}</label>
              <input id="subtitle" class="field w-full" [formField]="model.subtitle" />
            </div>
          }
          <div>
            <label for="cta" class="field-label">{{ isPromo() ? ('homeAdmin.ctaLabelOptional' | t) : ('homeAdmin.ctaLabel' | t) }}</label>
            <input id="cta" class="field w-full" [formField]="model.cta_label" />
          </div>
          <div>
            <label for="href" class="field-label">{{ isPromo() ? ('homeAdmin.hrefOptional' | t) : ('homeAdmin.href' | t) }}</label>
            <input id="href" class="field w-full" placeholder="/armazones" [formField]="model.cta_href" />
          </div>
          @if (!isPromo()) {
            <div>
              <label for="img" class="field-label">{{ 'homeAdmin.image' | t }}</label>
              <input id="img" type="file" [accept]="accept" class="block" (change)="upload($event)" [disabled]="uploading()" />
              @if (preview()) { <img [src]="preview()" [attr.alt]="'homeAdmin.previewAlt' | t" class="mt-2 h-24 rounded-lg object-cover" /> }
            </div>
            <div>
              <label for="alt" class="field-label">{{ 'homeAdmin.imageAlt' | t }}</label>
              <input id="alt" class="field w-full" [formField]="model.image_alt" />
            </div>
          }
          <div>
            <label for="starts" class="field-label">{{ 'homeAdmin.starts' | t }}</label>
            <input id="starts" type="datetime-local" class="field w-full" [formField]="model.starts_at" />
          </div>
          <div>
            <label for="ends" class="field-label">{{ 'homeAdmin.ends' | t }}</label>
            <input id="ends" type="datetime-local" class="field w-full" [formField]="model.ends_at" />
          </div>
          <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" [formField]="model.active" /> {{ 'common.active' | t }}</label>
          @if (error()) { <p role="alert" class="alert-error sm:col-span-2">{{ error() }}</p> }
          <div class="flex flex-wrap gap-2 border-t border-border pt-4 sm:col-span-2">
            <button type="submit" class="btn btn-primary" [disabled]="busy() || uploading()">{{ 'common.save' | t }}</button>
            <button type="button" class="btn btn-secondary" (click)="editing.set(false)">{{ 'common.cancel' | t }}</button>
          </div>
        </form>
      </section>
    }

    @if (loadError()) { <p role="alert" class="alert-error mb-4">{{ loadError() }}</p> }

    @for (group of groups(); track group.value) {
      <section class="mb-8" [attr.aria-labelledby]="'g-' + group.value">
        <h2 [id]="'g-' + group.value" class="mb-3 text-lg">{{ group.label }}</h2>
        <div class="panel overflow-x-auto">
          <table class="data-table stack">
            <thead><tr><th scope="col">{{ 'homeAdmin.bannerTitle' | t }}</th><th scope="col">{{ 'common.status' | t }}</th><th scope="col">{{ 'homeAdmin.validity' | t }}</th><th scope="col"><span class="sr-only">{{ 'common.edit' | t }}</span></th></tr></thead>
            <tbody>
              @for (b of group.items; track b.id; let i = $index) {
                <tr>
                  <td class="font-medium">{{ b.title }}</td>
                  <td [attr.data-label]="'common.status' | t">
                    <span class="inline-flex flex-wrap items-center justify-end gap-1.5">
                      <span class="pill"><span class="size-1.5 rounded-full" [class]="tone(b)" aria-hidden="true"></span>{{ status(b) }}</span>
                      @if (shown().has(b.id)) { <span class="pill bg-secondary font-semibold">{{ 'homeAdmin.shown' | t }}</span> }
                    </span>
                  </td>
                  <td class="text-muted-foreground" [attr.data-label]="'homeAdmin.validity' | t">{{ range(b) }}</td>
                  <td class="actions">
                    <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveUp' | t: { name: b.title }" [disabled]="i === 0" (click)="shift(group.value, i, -1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
                    <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveDown' | t: { name: b.title }" [disabled]="i === group.items.length - 1" (click)="shift(group.value, i, 1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
                    <button type="button" class="link" (click)="startEdit(b)">{{ 'common.edit' | t }}</button>
                    <button type="button" class="link" (click)="remove(b)">{{ 'homeAdmin.delete' | t }}</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="empty">{{ 'homeAdmin.noBanners' | t }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    <section class="max-w-3xl" aria-labelledby="ftitle">
      <h2 id="ftitle" class="mb-1 text-lg">{{ 'homeAdmin.featured' | t }}</h2>
      <p class="mb-4 text-sm text-muted-foreground">{{ 'homeAdmin.featuredHint' | t: { max: maxFeatured } }}</p>
      <div class="mb-4 max-w-xs">
        <label for="fcat" class="field-label">{{ 'productos.category' | t }}</label>
        <select id="fcat" class="field w-full" (change)="pickCategory($event)">
          @for (o of categories; track o.value) { <option [value]="o.value" [selected]="o.value === category()">{{ o.label }}</option> }
        </select>
      </div>
      <ol class="panel mb-4 divide-y divide-border text-sm">
        @for (p of featured(); track p.id; let i = $index) {
          <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span class="flex flex-wrap items-center gap-2"><span class="grid size-6 place-items-center rounded-full bg-secondary text-xs font-semibold tabular-nums">{{ i + 1 }}</span> <span class="font-medium">{{ p.name }}</span> <span class="text-muted-foreground">{{ p.brand.name }}</span>
              @if (hidden(p)) { <span class="pill bg-destructive/10 text-destructive">{{ 'homeAdmin.notShown' | t }}</span> }
            </span>
            <span class="flex items-center gap-2">
              <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveUp' | t: { name: p.name }" [disabled]="i === 0" (click)="shiftFeatured(i, -1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
              <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveDown' | t: { name: p.name }" [disabled]="i === featured().length - 1" (click)="shiftFeatured(i, 1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
              <button type="button" class="link" (click)="removeFeatured(p.id)">{{ 'homeAdmin.removeFeatured' | t }}</button>
            </span>
          </li>
        } @empty {
          <li class="px-4 py-6 text-center text-muted-foreground">{{ 'homeAdmin.noFeatured' | t }}</li>
        }
      </ol>
      <form class="mb-3 flex items-end gap-2" (submit)="search($event)">
        <div class="grow">
          <label for="fq" class="field-label">{{ 'homeAdmin.searchProduct' | t }}</label>
          <input id="fq" class="field w-full" [value]="query()" (input)="query.set($any($event.target).value)" />
        </div>
        <button type="submit" class="btn btn-secondary">{{ 'homeAdmin.search' | t }}</button>
      </form>
      @if (featuredError()) { <p role="alert" class="alert-error mb-2">{{ featuredError() }}</p> }
      <ul class="mb-4 divide-y divide-border text-sm">
        @for (p of results(); track p.id) {
          <li class="flex items-center justify-between gap-3 py-2">
            <span><span class="text-muted-foreground">{{ p.brand.name }}</span> {{ p.name }}</span>
            <button type="button" class="link" [disabled]="isFeatured(p.id) || featured().length >= maxFeatured" (click)="addFeatured(p)">{{ 'homeAdmin.add' | t }}</button>
          </li>
        }
      </ul>
      <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="saveFeatured()">{{ 'homeAdmin.saveFeatured' | t }}</button>
      @if (featuredOk()) { <p role="status" class="alert-ok mt-3">{{ featuredOk() }}</p> }
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
  protected status = (b: AdminHomeBanner) => STATUS_LABEL[bannerStatus(b)];
  protected tone = (b: AdminHomeBanner) => STATUS_DOT[bannerStatus(b)];
  protected range = (b: AdminHomeBanner) =>
    t('homeAdmin.range', { start: utcToCdmxInput(b.starts_at).replace('T', ' ') || t('homeAdmin.noStart'), end: utcToCdmxInput(b.ends_at).replace('T', ' ') || t('homeAdmin.noEnd') });

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
      this.loadError.set(problemMessage(e, t('homeAdmin.loadFailed')));
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
      this.error.set(problemMessage(e, t('homeAdmin.uploadFailed')));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async save(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return this.error.set(t('common.checkRequired'));
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
      this.error.set(problemMessage(e, t('homeAdmin.saveFailed')));
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
      this.loadError.set(problemMessage(e, t('common.reorderFailed')));
    }
  }

  protected async remove(b: AdminHomeBanner) {
    if (!confirm(t('homeAdmin.confirmDelete', { title: b.title }))) return;
    try {
      await firstValueFrom(this.api.adminDeleteHomeBanner(b.id));
      await this.loadBanners();
    } catch (e) {
      this.loadError.set(problemMessage(e, t('homeAdmin.deleteFailed')));
    }
  }

  private async loadFeatured() {
    try {
      const res = await firstValueFrom(this.api.adminListHomeFeatured({ category: this.category() }));
      this.featured.set(res.items as AdminProduct[]);
    } catch (e) {
      this.featuredError.set(problemMessage(e, t('homeAdmin.featuredLoadFailed')));
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
      this.featuredError.set(problemMessage(e, t('homeAdmin.searchFailed')));
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
      this.featuredOk.set(t('homeAdmin.featuredSaved'));
    } catch (e) {
      this.featuredError.set(problemMessage(e, t('homeAdmin.featuredSaveFailed')));
    } finally {
      this.busy.set(false);
    }
  }
}
