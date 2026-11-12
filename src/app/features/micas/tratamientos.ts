import { Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, maxLength, min, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminLensTreatment, VisionType } from '../../api/generated/model';
import { toOptions } from '../../core/frame-labels';
import { move } from '../../core/images';
import {
  emptyTreatmentForm, MAX_BADGE, MAX_TREATMENT_DESCRIPTION, MAX_TREATMENT_NAME, toggleVision, TREATMENT_ICON_LABEL, TREATMENT_VISIONS,
  treatmentFormFrom, treatmentInput, VISION_LABEL, type TreatmentForm,
} from '../../core/lens-treatments';
import { formatMxn } from '../../core/money';
import { problemMessage } from '../../core/problem';
import { slugify } from '../../core/slug';
import { t, TPipe } from '../../core/i18n';

/**
 * Pestaña "Tratamientos" de Micas (SPEC 17): alta, edición, orden y desactivación.
 * No hay borrar: los pedidos citan el tratamiento, así que solo se desactiva.
 */
@Component({
  selector: 'app-lens-treatments',
  imports: [FormField, TPipe],
  template: `
    <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg">{{ 'micas.tabs.treatments' | t }}</h2>
      <button type="button" class="btn btn-primary" (click)="startCreate()">{{ 'tratamientos.new' | t }}</button>
    </div>
    <p class="mb-4 max-w-3xl text-sm text-muted-foreground">{{ 'tratamientos.hint' | t }}</p>

    @if (editing()) {
      <section class="panel mb-8 max-w-3xl p-5 shadow-[0_4px_16px_rgb(14_34_48/0.08)]" aria-labelledby="ttitle">
        <h3 id="ttitle" class="mb-3 text-lg">{{ editingId() ? ('tratamientos.edit' | t) : ('tratamientos.new' | t) }}</h3>
        <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
          <div>
            <label for="tname" class="field-label">{{ 'tratamientos.name' | t }}</label>
            <input id="tname" class="field w-full" [formField]="model.name" (input)="autoSlug()" />
          </div>
          <div>
            <label for="tslug" class="field-label">{{ 'common.slug' | t }}</label>
            <input id="tslug" class="field w-full" [formField]="model.slug" (input)="slugTouched = true" />
          </div>
          <div>
            <label for="ticon" class="field-label">{{ 'tratamientos.icon' | t }}</label>
            <select id="ticon" class="field w-full" [formField]="model.icon">
              @for (o of icons; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          </div>
          <div>
            <label for="tprice" class="field-label">{{ 'tratamientos.pricePesos' | t }}</label>
            <input id="tprice" type="number" step="0.01" class="field w-full" [formField]="model.price_pesos" />
          </div>
          <div class="sm:col-span-2">
            <label for="tdesc" class="field-label">{{ 'tratamientos.description' | t }}</label>
            <textarea id="tdesc" rows="2" class="field w-full" [formField]="model.description"></textarea>
          </div>
          <div class="sm:col-span-2">
            <label for="tbadge" class="field-label">{{ 'micas.badge' | t }}</label>
            <input id="tbadge" class="field w-full" [formField]="model.badge" />
          </div>
          <fieldset class="sm:col-span-2" aria-describedby="tvision-hint">
            <legend class="field-label">{{ 'tratamientos.visionTypes' | t }}</legend>
            <div class="flex flex-wrap gap-x-5 gap-y-2">
              @for (v of visions; track v) {
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" [value]="v" [checked]="state().vision_types.includes(v)" (change)="setVision(v, $event)" />
                  {{ visionLabel[v] }}
                </label>
              }
            </div>
            <p id="tvision-hint" class="mt-1 text-xs text-muted-foreground">{{ 'tratamientos.visionTypesHint' | t }}</p>
          </fieldset>
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
        <thead><tr><th scope="col">{{ 'tratamientos.treatment' | t }}</th><th scope="col">{{ 'tratamientos.icon' | t }}</th><th scope="col">{{ 'tratamientos.visionTypes' | t }}</th><th scope="col" class="text-right">{{ 'common.price' | t }}</th><th scope="col">{{ 'common.status' | t }}</th><th scope="col"><span class="sr-only">{{ 'common.edit' | t }}</span></th></tr></thead>
        <tbody>
          @for (tr of treatments(); track tr.id; let i = $index) {
            <tr>
              <td>{{ tr.name }} @if (tr.badge) { <span class="pill ml-1">{{ tr.badge }}</span> }</td>
              <td [attr.data-label]="'tratamientos.icon' | t">{{ iconLabel[tr.icon] }}</td>
              <td [attr.data-label]="'tratamientos.visionTypes' | t">{{ visionsOf(tr) }}</td>
              <td class="text-right font-semibold tabular-nums" [attr.data-label]="'common.price' | t">{{ money(tr.price_cents) }}</td>
              <td [attr.data-label]="'common.status' | t">
                <span class="pill"><span class="size-1.5 rounded-full" [class]="tr.active ? 'bg-good' : 'bg-muted-foreground'" aria-hidden="true"></span>{{ tr.active ? ('common.active' | t) : ('common.inactive' | t) }}</span>
              </td>
              <td class="actions">
                <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveUp' | t: { name: tr.name }" [disabled]="i === 0" (click)="shift(i, -1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
                <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveDown' | t: { name: tr.name }" [disabled]="i === treatments().length - 1" (click)="shift(i, 1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
                <button type="button" class="link" (click)="startEdit(tr)">{{ 'common.edit' | t }}</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="empty">{{ 'tratamientos.empty' | t }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export default class LensTreatments implements OnInit {
  private readonly api = inject(DefaultService);
  protected readonly treatments = signal<AdminLensTreatment[]>([]);
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly icons = toOptions(TREATMENT_ICON_LABEL);
  protected readonly iconLabel = TREATMENT_ICON_LABEL;
  protected readonly visions = TREATMENT_VISIONS;
  protected readonly visionLabel = VISION_LABEL;
  protected money = formatMxn;
  protected slugTouched = false;

  protected readonly state = signal<TreatmentForm>(emptyTreatmentForm());
  protected readonly model = form(this.state, (f) => {
    required(f.name);
    maxLength(f.name, MAX_TREATMENT_NAME);
    required(f.slug);
    maxLength(f.description, MAX_TREATMENT_DESCRIPTION);
    maxLength(f.badge, MAX_BADGE);
    required(f.price_pesos);
    min(f.price_pesos, 0);
  });

  async ngOnInit() {
    try {
      this.treatments.set((await firstValueFrom(this.api.adminListLensTreatments())).items);
    } catch (e) {
      this.loadError.set(problemMessage(e, t('tratamientos.loadFailed')));
    }
  }

  protected visionsOf(tr: AdminLensTreatment): string {
    return tr.vision_types.map((v) => VISION_LABEL[v] ?? v).join(', ');
  }

  protected startCreate() {
    this.slugTouched = false;
    this.editingId.set(null);
    this.state.set(emptyTreatmentForm());
    this.error.set(null);
    this.editing.set(true);
  }

  protected startEdit(tr: AdminLensTreatment) {
    this.slugTouched = true;
    this.editingId.set(tr.id);
    this.state.set(treatmentFormFrom(tr));
    this.error.set(null);
    this.editing.set(true);
  }

  protected autoSlug() {
    if (!this.slugTouched && !this.editingId()) this.state.update((s) => ({ ...s, slug: slugify(s.name) }));
  }

  protected setVision(v: VisionType, event: Event) {
    const on = (event.target as HTMLInputElement).checked;
    this.state.update((s) => ({ ...s, vision_types: toggleVision(s.vision_types, v, on) }));
  }

  protected async save(event: Event) {
    event.preventDefault();
    const body = treatmentInput(this.state());
    if (typeof body === 'string') return this.error.set(body);
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      const saved = await firstValueFrom(id ? this.api.adminUpdateLensTreatment(id, body) : this.api.adminCreateLensTreatment(body));
      this.treatments.update((list) => (id ? list.map((x) => (x.id === id ? saved : x)) : [...list, saved]));
      this.editing.set(false);
    } catch (e) {
      this.error.set(problemMessage(e, t('tratamientos.saveFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async shift(index: number, dir: -1 | 1) {
    const ids = move(this.treatments(), index, dir).map((x) => x.id);
    try {
      this.treatments.set((await firstValueFrom(this.api.adminReorderLensTreatments({ treatment_ids: ids }))).items);
    } catch (e) {
      this.loadError.set(problemMessage(e, t('common.reorderFailed')));
    }
  }
}
