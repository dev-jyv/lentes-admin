import { Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, min, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import { VisionType } from '../../api/generated/model';
import type { AdminLensPackage, LensPackageInput } from '../../api/generated/model';
import { toOptions } from '../../core/frame-labels';
import { move } from '../../core/images';
import { centsToPesos, formatMxn, pesosToCents } from '../../core/money';
import { problemMessage } from '../../core/problem';
import { slugify } from '../../core/slug';
import { t, TPipe } from '../../core/i18n';

const VISION_LABEL: Record<VisionType, string> = t('labels.vision', { returnObjects: true });

interface PackageForm {
  name: string;
  slug: string;
  description: string;
  vision_type: VisionType;
  price_pesos: number | null;
  active: boolean;
}

const empty = (): PackageForm => ({
  name: '', slug: '', description: '', vision_type: VisionType.single_vision, price_pesos: null, active: true,
});

@Component({
  selector: 'app-micas',
  imports: [FormField, TPipe],
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl">{{ 'nav.micas' | t }}</h1>
      <button type="button" class="rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground" (click)="startCreate()">{{ 'micas.new' | t }}</button>
    </div>

    @if (editing()) {
      <section class="mb-8 max-w-3xl rounded-2xl border border-border bg-card p-4" aria-labelledby="ptitle">
        <h2 id="ptitle" class="mb-3 font-medium">{{ editingId() ? ('micas.edit' | t) : ('micas.new' | t) }}</h2>
        <form class="grid gap-3 sm:grid-cols-2" (submit)="save($event)">
          <div>
            <label for="pname" class="mb-1 block text-sm">{{ 'common.name' | t }}</label>
            <input id="pname" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.name" (input)="autoSlug()" />
          </div>
          <div>
            <label for="pslug" class="mb-1 block text-sm">{{ 'common.slug' | t }}</label>
            <input id="pslug" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.slug" />
          </div>
          <div>
            <label for="vision" class="mb-1 block text-sm">{{ 'micas.visionType' | t }}</label>
            <select id="vision" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.vision_type">
              @for (o of visions; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
            <p class="mt-1 text-xs text-muted-foreground">{{ 'micas.visionHint' | t }}</p>
          </div>
          <div>
            <label for="price" class="mb-1 block text-sm">{{ 'micas.pricePesos' | t }}</label>
            <input id="price" type="number" step="0.01" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.price_pesos" />
          </div>
          <div class="sm:col-span-2">
            <label for="desc" class="mb-1 block text-sm">{{ 'common.description' | t }}</label>
            <textarea id="desc" rows="2" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.description"></textarea>
          </div>
          <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" [formField]="model.active" /> {{ 'micas.activeForSale' | t }}</label>
          @if (error()) { <p role="alert" class="text-sm text-destructive sm:col-span-2">{{ error() }}</p> }
          <div class="flex gap-2 sm:col-span-2">
            <button type="submit" class="rounded-full bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" [disabled]="busy()">{{ 'common.save' | t }}</button>
            <button type="button" class="rounded-full border border-input px-3 py-2" (click)="editing.set(false)">{{ 'common.cancel' | t }}</button>
          </div>
        </form>
      </section>
    }

    @if (loadError()) { <p role="alert" class="mb-4 text-sm text-destructive">{{ loadError() }}</p> }
    <table class="w-full text-sm">
      <thead><tr class="border-b text-left"><th class="py-2">{{ 'micas.package' | t }}</th><th>{{ 'common.type' | t }}</th><th>{{ 'micas.prescription' | t }}</th><th>{{ 'common.price' | t }}</th><th>{{ 'common.status' | t }}</th><th></th></tr></thead>
      <tbody>
        @for (p of packages(); track p.id; let i = $index) {
          <tr class="border-b">
            <td class="py-2">{{ p.name }}</td>
            <td>{{ visionLabel[p.vision_type] }}</td>
            <td>{{ p.requires_prescription ? ('micas.requires' | t) : ('common.no' | t) }}</td>
            <td>{{ money(p.price_cents) }}</td>
            <td>{{ p.active ? ('common.active' | t) : ('common.inactive' | t) }}</td>
            <td class="space-x-3 text-right">
              <button type="button" class="underline disabled:opacity-40" [attr.aria-label]="'micas.moveUp' | t: { name: p.name }" [disabled]="i === 0" (click)="shift(i, -1)">↑</button>
              <button type="button" class="underline disabled:opacity-40" [attr.aria-label]="'micas.moveDown' | t: { name: p.name }" [disabled]="i === packages().length - 1" (click)="shift(i, 1)">↓</button>
              <button type="button" class="underline" (click)="startEdit(p)">{{ 'common.edit' | t }}</button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="6" class="py-4 text-muted-foreground">{{ 'micas.empty' | t }}</td></tr>
        }
      </tbody>
    </table>
  `,
})
export default class Micas implements OnInit {
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
      name: p.name, slug: p.slug, description: p.description ?? '', vision_type: p.vision_type,
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
    if (this.model().invalid()) return this.error.set(t('common.checkRequired'));
    const s = this.state();
    const body: LensPackageInput = {
      name: s.name.trim(), slug: s.slug.trim(), description: s.description.trim() || null, vision_type: s.vision_type,
      price_cents: pesosToCents(s.price_pesos!), active: s.active,
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
