import { HttpClient } from '@angular/common/http';
import { afterNextRender, Component, computed, ElementRef, inject, Injector, OnInit, signal, viewChild } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import { BannerPlacement, HeroArt, ProductCategory, PromiseIcon } from '../../api/generated/model';
import type { AdminHomeBanner, AdminProduct, Product } from '../../api/generated/model';
import {
  bannerBody, bannerFields, bannerFormFrom, emptyBannerForm, HERO_ARTS, MAX_MENU_CARDS, MAX_PROMISES, MOSAIC_SLOTS,
  PROMISE_ICONS, REORDER_SLOT, reorderWithin, type BannerForm,
} from '../../core/banner-form';
import { shownBannerIds } from '../../core/banner-status';
import { CatalogStore } from '../../core/catalogs';
import { CATEGORY_LABEL, toOptions } from '../../core/frame-labels';
import { IMAGE_TYPES, ImageType, move, validateImage } from '../../core/images';
import { problemMessage } from '../../core/problem';
import { t, TPipe } from '../../core/i18n';
import { PromiseIconView } from '../../shared/promise-icon';
import { BannerTable } from './banner-table';
import { MosaicGrid, type MosaicCell } from './mosaic-grid';

const PLACEMENT_LABEL: Record<BannerPlacement, string> = t('labels.placement', { returnObjects: true });
const ICON_LABEL: Record<PromiseIcon, string> = t('labels.promiseIcon', { returnObjects: true });
const ART_LABEL: Record<HeroArt, string> = t('labels.heroArt', { returnObjects: true });
const SLOT_LABEL: Record<string, string> = t('homeAdmin.slots', { returnObjects: true });

const MAX_FEATURED = 8;

/** Ubicaciones de SPEC 02 que se listan en una tabla simple; megamenú, mosaico y promesas tienen su propia sección. */
const SIMPLE: BannerPlacement[] = [BannerPlacement.promo_bar, BannerPlacement.hero, BannerPlacement.secondary];

type FeaturedItem = Pick<Product, 'id' | 'name' | 'brand'> & { active?: boolean; from_price_cents?: number | null };

@Component({
  selector: 'app-home-content',
  imports: [FormField, TPipe, BannerTable, MosaicGrid, PromiseIconView],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="page-title">{{ 'nav.home' | t }}</h1>
      <button type="button" class="btn btn-primary" (click)="startCreate()">{{ 'homeAdmin.newBanner' | t }}</button>
    </div>

    @if (editing()) {
      <section class="panel mb-8 max-w-3xl p-5 shadow-[0_4px_16px_rgb(14_34_48/0.08)]" aria-labelledby="btitle">
        <h2 #formTitle id="btitle" tabindex="-1" class="mb-1 text-lg outline-none">{{ editingId() ? ('homeAdmin.editBanner' | t) : ('homeAdmin.newBanner' | t) }}</h2>
        <p class="mb-3 text-sm text-muted-foreground">{{ 'homeAdmin.honesty' | t }}</p>
        <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
          <div>
            <label for="placement" class="field-label">{{ 'homeAdmin.placement' | t }}</label>
            <select id="placement" class="field w-full" [formField]="model.placement">
              @for (o of placements; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          @if (fields().menu) {
            <div>
              <label for="menu" class="field-label">{{ 'homeAdmin.menu' | t }}</label>
              <select id="menu" class="field w-full" [formField]="model.menu">
                <option value="">{{ 'common.choose' | t }}</option>
                @for (o of categories; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </div>
          }
          @if (fields().slot) {
            <div>
              <label for="slot" class="field-label">{{ 'homeAdmin.slot' | t }}</label>
              <select id="slot" class="field w-full" [formField]="model.slot">
                <option value="">{{ 'common.choose' | t }}</option>
                @for (o of slots(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
              @if (state().slot && state().slot !== reorderSlot) {
                <p class="mt-1 text-xs text-muted-foreground">{{ 'homeAdmin.slotPhotoHint' | t }}</p>
              }
              @if (state().slot === reorderSlot) {
                <p class="mt-1 text-xs text-muted-foreground">{{ 'homeAdmin.slotReorderHint' | t }}</p>
              }
            </div>
          }
          @if (fields().icon) {
            <fieldset class="sm:col-span-2" aria-describedby="icon-warning">
              <legend class="field-label">{{ 'homeAdmin.icon' | t }}</legend>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                @for (o of icons; track o.value) {
                  <label class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-input px-3 text-sm has-checked:border-primary has-checked:bg-accent">
                    <input type="radio" [value]="o.value" [formField]="model.icon" />
                    <app-promise-icon class="size-5 text-primary" [icon]="o.value" />
                    {{ o.label }}
                  </label>
                }
              </div>
              @if (state().icon === 'delivery') {
                <p id="icon-warning" class="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-foreground">{{ 'homeAdmin.deliveryWarning' | t }}</p>
              }
            </fieldset>
          }
          @if (fields().heroMode) {
            <fieldset class="sm:col-span-2">
              <legend class="field-label">{{ 'homeAdmin.heroMode' | t }}</legend>
              <div class="flex flex-wrap gap-4 text-sm">
                <label class="flex items-center gap-2"><input type="radio" value="image" [formField]="model.hero_mode" /> {{ 'homeAdmin.heroImage' | t }}</label>
                <label class="flex items-center gap-2"><input type="radio" value="art" [formField]="model.hero_mode" /> {{ 'homeAdmin.heroArt' | t }}</label>
              </div>
            </fieldset>
          }
          @if (fields().art) {
            <div>
              <label for="art" class="field-label">{{ 'homeAdmin.art' | t }}</label>
              <select id="art" class="field w-full" aria-describedby="art-hint" [formField]="model.art">
                <option value="">{{ 'common.choose' | t }}</option>
                @for (o of arts; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
              <p id="art-hint" class="mt-1 text-xs text-muted-foreground">{{ 'homeAdmin.artHint' | t }}</p>
            </div>
          }
          @if (fields().title) {
            <div>
              <label for="title" class="field-label">{{ 'homeAdmin.titleMax' | t: { max: fields().titleMax } }}</label>
              <input id="title" class="field w-full" [formField]="model.title" />
            </div>
          }
          @if (fields().subtitle) {
            <div class="sm:col-span-2">
              <label for="subtitle" class="field-label">{{ 'homeAdmin.subtitleMax' | t: { max: fields().subtitleMax } }}</label>
              <input id="subtitle" class="field w-full" [formField]="model.subtitle" />
            </div>
          }
          @if (fields().ctaLabel) {
            <div>
              <label for="cta" class="field-label">{{ fields().ctaLabel === 'optional' ? ('homeAdmin.ctaLabelOptional' | t) : ('homeAdmin.ctaLabel' | t) }}</label>
              <input id="cta" class="field w-full" [formField]="model.cta_label" />
            </div>
          }
          @if (fields().ctaHref) {
            <div>
              <label for="href" class="field-label">{{ fields().ctaHref === 'optional' ? ('homeAdmin.hrefOptional' | t) : ('homeAdmin.href' | t) }}</label>
              <input id="href" class="field w-full" placeholder="/armazones" [formField]="model.cta_href" />
            </div>
          }
          @if (fields().image) {
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
        <app-banner-table [items]="group.items" [shown]="shown()" [detail]="heroDetail"
          (edit)="startEdit($event)" (remove)="remove($event)" (shift)="shift(group.value, $event.index, $event.dir)" />
      </section>
    }

    <section class="mb-8" aria-labelledby="g-menu_card">
      <div class="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 id="g-menu_card" class="text-lg">{{ 'homeAdmin.sections.menu' | t }}</h2>
      </div>
      <p class="mb-3 max-w-3xl text-sm text-muted-foreground">{{ 'homeAdmin.menuHint' | t: { max: maxMenuCards } }}</p>
      <div class="space-y-4">
        @for (m of menus(); track m.value) {
          <div>
            <app-banner-table [items]="m.items" [shown]="shown()" [caption]="m.label"
              (edit)="startEdit($event)" (remove)="remove($event)" (shift)="shiftMenu(m.value, $event.index, $event.dir)" />
            <button type="button" class="btn btn-secondary btn-sm mt-2" (click)="startCreate(placement.menu_card, { menu: m.value })">{{ 'homeAdmin.addCard' | t: { menu: m.label } }}</button>
          </div>
        }
      </div>
    </section>

    <section class="mb-8" aria-labelledby="g-mosaic">
      <h2 id="g-mosaic" class="mb-1 text-lg">{{ 'homeAdmin.sections.mosaic' | t }}</h2>
      <p class="mb-3 max-w-3xl text-sm text-muted-foreground">{{ 'homeAdmin.mosaicHint' | t }}</p>
      <div class="mb-4"><app-mosaic-grid [cells]="mosaicCells()" (pick)="pickCell($event)" /></div>
      <app-banner-table [items]="mosaicItems()" [shown]="shown()" [reorderable]="false" [name]="mosaicName"
        [caption]="'homeAdmin.mosaicAll' | t" (edit)="startEdit($event)" (remove)="remove($event)" />
    </section>

    <section class="mb-8" aria-labelledby="g-promise">
      <div class="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 id="g-promise" class="text-lg">{{ 'homeAdmin.sections.promise' | t }}</h2>
        <button type="button" class="btn btn-secondary btn-sm" (click)="startCreate(placement.promise)">{{ 'homeAdmin.addPromise' | t }}</button>
      </div>
      <p class="mb-3 max-w-3xl text-sm text-muted-foreground">{{ 'homeAdmin.promiseHint' | t: { max: maxPromises } }}</p>
      <app-banner-table [items]="promises()" [shown]="shown()" [detail]="iconDetail"
        (edit)="startEdit($event)" (remove)="remove($event)" (shift)="shift(placement.promise, $event.index, $event.dir)" />
    </section>

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
  private readonly injector = inject(Injector);
  private readonly catalogs = inject(CatalogStore);
  private readonly formTitle = viewChild<ElementRef<HTMLElement>>('formTitle');

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
  protected readonly maxMenuCards = MAX_MENU_CARDS;
  protected readonly maxPromises = MAX_PROMISES;
  protected readonly placement = BannerPlacement;
  protected readonly reorderSlot = REORDER_SLOT;
  protected readonly placements = toOptions(PLACEMENT_LABEL);
  protected readonly categories = toOptions(CATEGORY_LABEL);
  protected readonly icons = PROMISE_ICONS.map((value) => ({ value, label: ICON_LABEL[value] }));
  protected readonly arts = HERO_ARTS.map((value) => ({ value, label: ART_LABEL[value] }));

  /** Etiqueta de una celda: los tipos de lente usan la etiqueta del catálogo (SPEC 16). */
  protected readonly slotLabel = (slot: string | null | undefined): string => {
    if (!slot) return '—';
    if (slot.startsWith('lens_type:')) return this.catalogs.label('lens_type', slot.slice('lens_type:'.length));
    return SLOT_LABEL[slot] ?? slot;
  };
  protected readonly slots = computed(() => {
    this.catalogs.catalogs(); // se recalcula cuando llega el catálogo
    return MOSAIC_SLOTS.map((value) => ({ value, label: this.slotLabel(value) }));
  });

  protected readonly state = signal<BannerForm>(emptyBannerForm());
  protected readonly fields = computed(() => bannerFields(this.state()));
  protected readonly model = form(this.state, (f) => {
    required(f.title, { when: () => this.fields().title === 'required' });
  });

  protected readonly shown = computed(() => shownBannerIds(this.banners()));
  private readonly sorted = computed(() => [...this.banners()].sort((a, b) => a.position - b.position));
  private readonly of = (p: BannerPlacement) => this.sorted().filter((b) => b.placement === p);
  protected readonly groups = computed(() =>
    SIMPLE.map((value) => ({ value, label: PLACEMENT_LABEL[value], items: this.of(value) })),
  );
  protected readonly menus = computed(() =>
    this.categories.map((c) => ({ ...c, items: this.of(BannerPlacement.menu_card).filter((b) => b.menu === c.value) })),
  );
  protected readonly mosaicItems = computed(() =>
    [...this.of(BannerPlacement.mosaic)].sort((a, b) => MOSAIC_SLOTS.indexOf(a.slot as never) - MOSAIC_SLOTS.indexOf(b.slot as never)),
  );
  /** La celda muestra el banner vigente que la tienda usa en ese slot. */
  protected readonly mosaicCells = computed<MosaicCell[]>(() => {
    const shown = this.shown();
    this.catalogs.catalogs();
    return MOSAIC_SLOTS.map((slot) => ({
      slot,
      label: this.slotLabel(slot),
      banner: this.mosaicItems().find((b) => b.slot === slot && shown.has(b.id)) ?? null,
    }));
  });
  protected readonly promises = computed(() => this.of(BannerPlacement.promise));

  protected readonly heroDetail = (b: AdminHomeBanner) =>
    b.placement === BannerPlacement.hero && !b.image_key && b.art ? t('homeAdmin.artDetail', { art: ART_LABEL[b.art] }) : null;
  protected readonly iconDetail = (b: AdminHomeBanner) => (b.icon ? ICON_LABEL[b.icon] : null);
  protected readonly mosaicName = (b: AdminHomeBanner) =>
    b.slot === REORDER_SLOT ? `${this.slotLabel(b.slot)} · ${b.title}` : this.slotLabel(b.slot);

  protected readonly category = signal<ProductCategory>(ProductCategory.frame);
  protected readonly featured = signal<FeaturedItem[]>([]);
  protected readonly results = signal<Product[]>([]);
  protected readonly query = signal('');
  protected readonly featuredError = signal<string | null>(null);
  protected readonly featuredOk = signal<string | null>(null);
  protected hidden = (p: FeaturedItem) => p.active === false || p.from_price_cents == null;
  protected isFeatured = (id: string) => this.featured().some((p) => p.id === id);

  async ngOnInit() {
    // El catálogo solo aporta etiquetas de tipos de lente; si falla, se usa el código legible.
    await Promise.all([this.loadBanners(), this.loadFeatured(), this.catalogs.load()]);
  }

  private async loadBanners() {
    try {
      this.banners.set((await firstValueFrom(this.api.adminListHomeBanners())).items);
    } catch (e) {
      this.loadError.set(problemMessage(e, t('homeAdmin.loadFailed')));
    }
  }

  /** Abre el formulario y lleva el foco a su título (las secciones de abajo también lo abren). */
  private open() {
    this.error.set(null);
    this.editing.set(true);
    afterNextRender(() => {
      const el = this.formTitle()?.nativeElement;
      el?.focus();
      el?.scrollIntoView?.({ block: 'start' });
    }, { injector: this.injector });
  }

  protected startCreate(placement: BannerPlacement = BannerPlacement.promo_bar, extra: Partial<BannerForm> = {}) {
    this.editingId.set(null);
    this.state.set(emptyBannerForm(placement, extra));
    this.imageKey.set(null);
    this.preview.set(null);
    this.open();
  }

  protected startEdit(b: AdminHomeBanner) {
    this.editingId.set(b.id);
    this.state.set(bannerFormFrom(b));
    this.imageKey.set(b.image_key ?? null);
    this.preview.set(b.image_url ?? null);
    this.open();
  }

  /** Una celda del mosaico: edita su banner vigente o crea uno para ese slot. */
  protected pickCell(cell: MosaicCell) {
    if (cell.banner) this.startEdit(cell.banner);
    else this.startCreate(BannerPlacement.mosaic, { slot: cell.slot });
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
    const body = bannerBody(this.state(), this.imageKey());
    if (typeof body === 'string') return this.error.set(body);
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      await firstValueFrom(id ? this.api.adminUpdateHomeBanner(id, body) : this.api.adminCreateHomeBanner(body));
      await this.loadBanners();
      this.editing.set(false);
    } catch (e) {
      // 409: otro banner del mosaico vigente en la misma celda; la API dice cuál y qué hacer.
      this.error.set(problemMessage(e, t('homeAdmin.saveFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  private async reorder(placement: BannerPlacement, ids: string[]) {
    try {
      await firstValueFrom(this.api.adminReorderHomeBanners({ placement, banner_ids: ids }));
      await this.loadBanners();
    } catch (e) {
      this.loadError.set(problemMessage(e, t('common.reorderFailed')));
    }
  }

  protected shift(placement: BannerPlacement, index: number, dir: -1 | 1) {
    return this.reorder(placement, reorderWithin(this.of(placement), () => true, index, dir));
  }

  /** Las tarjetas se ordenan dentro de su menú; la API recibe todas las tarjetas de ambos menús. */
  protected shiftMenu(menu: ProductCategory, index: number, dir: -1 | 1) {
    const all = this.of(BannerPlacement.menu_card);
    return this.reorder(BannerPlacement.menu_card, reorderWithin(all, (b) => b.menu === menu, index, dir));
  }

  protected async remove(b: AdminHomeBanner) {
    const name = b.title || this.slotLabel(b.slot);
    if (!confirm(t('homeAdmin.confirmDelete', { title: name }))) return;
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
