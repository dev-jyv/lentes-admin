import { Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, maxLength, min, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import { VisionType } from '../../api/generated/model';
import type { AdminLensPackage, LensPackageInput } from '../../api/generated/model';
import { toOptions } from '../../core/frame-labels';
import { move } from '../../core/images';
import { MAX_BADGE, VISION_LABEL } from '../../core/lens-treatments';
import { centsToPesos, formatMxn, pesosToCents } from '../../core/money';
import { problemMessage } from '../../core/problem';
import { slugify } from '../../core/slug';
import { t, TPipe } from '../../core/i18n';

interface PackageForm {
  name: string;
  slug: string;
  description: string;
  vision_type: VisionType;
  badge: string;
  price_pesos: number | null;
  active: boolean;
}

const empty = (): PackageForm => ({
  name: '', slug: '', description: '', vision_type: VisionType.single_vision, badge: '', price_pesos: null, active: true,
});

/** Pestaña "Necesidades visuales" de Micas: los paquetes de micas (`vision_type`, precio, etiqueta). */
@Component({
  selector: 'app-lens-packages',
  imports: [FormField, TPipe],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg">{{ 'micas.tabs.packages' | t }}</h2>
      <button type="button" class="btn btn-primary" (click)="startCreate()">{{ 'micas.new' | t }}</button>
    </div>

    @if (editing()) {
      <section class="panel mb-8 max-w-3xl p-5 shadow-[0_4px_16px_rgb(14_34_48/0.08)]" aria-labelledby="ptitle">
        <h3 id="ptitle" class="mb-3 text-lg">{{ editingId() ? ('micas.edit' | t) : ('micas.new' | t) }}</h3>
        <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
          <div>
            <label for="pname" class="field-label">{{ 'common.name' | t }}</label>
            <input id="pname" class="field w-full" [formField]="model.name" (input)="autoSlug()" />
          </div>
          <div>
            <label for="pslug" class="field-label">{{ 'common.slug' | t }}</label>
            <input id="pslug" class="field w-full" [formField]="model.slug" />
          </div>
          <div>
            <label for="vision" class="field-label">{{ 'micas.visionType' | t }}</label>
            <select id="vision" class="field w-full" [formField]="model.vision_type">
              @for (o of visions; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
            <p class="mt-1 text-xs text-muted-foreground">{{ 'micas.visionHint' | t }}</p>
          </div>
          <div>
            <label for="price" class="field-label">{{ 'micas.pricePesos' | t }}</label>
            <input id="price" type="number" step="0.01" class="field w-full" [formField]="model.price_pesos" />
          </div>
          <div class="sm:col-span-2">
            <label for="pbadge" class="field-label">{{ 'micas.badge' | t }}</label>
            <input id="pbadge" class="field w-full" aria-describedby="pbadge-hint" [formField]="model.badge" />
            <p id="pbadge-hint" class="mt-1 text-xs text-muted-foreground">{{ 'micas.badgeHint' | t }}</p>
          </div>
          <div class="sm:col-span-2">
            <label for="desc" class="field-label">{{ 'common.description' | t }}</label>
            <textarea id="desc" rows="2" class="field w-full" [formField]="model.description"></textarea>
          </div>
          <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" [formField]="model.active" /> {{ 'micas.activeForSale' | t }}</label>
          @if (error()) { <p role="alert" class="alert-error sm:col-span-2">{{ error() }}</p> }
          <div class="flex flex-wrap gap-2 border-t border-border pt-4 sm:col-span-2">
            <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ 'common.save' | t }}</button>
            <button type="button" class="btn btn-secondary" (click)="editing.set(false)">{{ 'common.cancel' | t }}</button>
          </div>
        </form>
      </section>
    }

    @if (loadError()) { <p role="alert" class="alert-error mb-4">{{ loadError() }}</p> }
    <div class="panel overflow-x-auto">
      <table class="data-table stack">
        <thead><tr><th scope="col">{{ 'micas.package' | t }}</th><th scope="col">{{ 'common.type' | t }}</th><th scope="col">{{ 'micas.prescription' | t }}</th><th scope="col" class="text-right">{{ 'common.price' | t }}</th><th scope="col">{{ 'common.status' | t }}</th><th scope="col"><span class="sr-only">{{ 'common.edit' | t }}</span></th></tr></thead>
        <tbody>
          @for (p of packages(); track p.id; let i = $index) {
            <tr>
              <td>{{ p.name }} @if (p.badge) { <span class="pill ml-1">{{ p.badge }}</span> }</td>
              <td [attr.data-label]="'common.type' | t">{{ visionLabel[p.vision_type] }}</td>
              <td [attr.data-label]="'micas.prescription' | t">{{ p.requires_prescription ? ('micas.requires' | t) : ('common.no' | t) }}</td>
              <td class="text-right font-semibold tabular-nums" [attr.data-label]="'common.price' | t">{{ money(p.price_cents) }}</td>
              <td [attr.data-label]="'common.status' | t">
                <span class="pill"><span class="size-1.5 rounded-full" [class]="p.active ? 'bg-good' : 'bg-muted-foreground'" aria-hidden="true"></span>{{ p.active ? ('common.active' | t) : ('common.inactive' | t) }}</span>
              </td>
              <td class="actions">
                <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveUp' | t: { name: p.name }" [disabled]="i === 0" (click)="shift(i, -1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
                <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveDown' | t: { name: p.name }" [disabled]="i === packages().length - 1" (click)="shift(i, 1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
                <button type="button" class="link" (click)="startEdit(p)">{{ 'common.edit' | t }}</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="empty">{{ 'micas.empty' | t }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export default class LensPackages implements OnInit {
  private readonly api = inject(DefaultService);
  protected readonly packages = signal<AdminLensPackage[]>([]);
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly visions = toOptions(VISION_LABEL);
  protected readonly visionLabel = VISION_LABEL;
  protected money = formatMxn;
  private slugTouched = false;

  private readonly state = signal<PackageForm>(empty());
  protected readonly model = form(this.state, (f) => {
    required(f.name);
    required(f.slug);
    required(f.price_pesos);
    min(f.price_pesos, 0);
    maxLength(f.badge, MAX_BADGE);
  });

  async ngOnInit() {
    try {
      this.packages.set((await firstValueFrom(this.api.adminListLensPackages())).items);
    } catch (e) {
      this.loadError.set(problemMessage(e, t('micas.loadFailed')));
    }
  }

  protected startCreate() {
    this.slugTouched = false;
    this.editingId.set(null);
    this.state.set(empty());
    this.error.set(null);
    this.editing.set(true);
  }

  protected startEdit(p: AdminLensPackage) {
    this.slugTouched = true;
    this.editingId.set(p.id);
    this.state.set({
      name: p.name, slug: p.slug, description: p.description ?? '', vision_type: p.vision_type, badge: p.badge ?? '',
      price_pesos: centsToPesos(p.price_cents), active: p.active,
    });
    this.error.set(null);
    this.editing.set(true);
  }

  protected autoSlug() {
    if (!this.slugTouched && !this.editingId()) this.state.update((s) => ({ ...s, slug: slugify(s.name) }));
  }

  protected async save(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return this.error.set(t(this.state().badge.length > MAX_BADGE ? 'common.checkLength' : 'common.checkRequired'));
    const s = this.state();
    const body: LensPackageInput = {
      name: s.name.trim(), slug: s.slug.trim(), description: s.description.trim() || null, vision_type: s.vision_type,
      badge: s.badge.trim() || null, price_cents: pesosToCents(s.price_pesos!), active: s.active,
    };
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      const saved = await firstValueFrom(id ? this.api.adminUpdateLensPackage(id, body) : this.api.adminCreateLensPackage(body));
      this.packages.update((list) => (id ? list.map((p) => (p.id === id ? saved : p)) : [...list, saved]));
      this.editing.set(false);
    } catch (e) {
      this.error.set(problemMessage(e, t('micas.saveFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async shift(index: number, dir: -1 | 1) {
    const ids = move(this.packages(), index, dir).map((p) => p.id);
    try {
      this.packages.set((await firstValueFrom(this.api.adminReorderLensPackages({ package_ids: ids }))).items);
    } catch (e) {
      this.loadError.set(problemMessage(e, t('common.reorderFailed')));
    }
  }
}
