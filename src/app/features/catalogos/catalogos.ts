import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, maxLength, readonly, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import { CatalogKind } from '../../api/generated/model';
import type { CatalogValue } from '../../api/generated/model';
import {
  CATALOG_KINDS, catalogCode, MAX_CATALOG_LABEL, CatalogStore, catalogValueInput, catalogValuePatch, isFixedCatalog, normalizeSwatch,
  type CatalogValueForm,
} from '../../core/catalogs';
import { move } from '../../core/images';
import { problemMessage } from '../../core/problem';
import { t, TPipe } from '../../core/i18n';

const KIND_LABEL: Record<CatalogKind, string> = t('catalogos.kinds', { returnObjects: true });

const empty = (): CatalogValueForm => ({ label: '', code: '', swatch: '' });

/** Un valor se puede borrar solo si no es de sistema y ningún producto lo usa; si no, se oculta. */
export const canDelete = (v: CatalogValue): boolean => !v.system && (v.product_count ?? 0) === 0;

@Component({
  selector: 'app-catalogos',
  imports: [FormField, TPipe],
  template: `
    <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
      <h1 class="page-title">{{ 'nav.catalogos' | t }}</h1>
      @if (!fixed()) {
        <button type="button" class="btn btn-primary" (click)="startCreate()">{{ 'catalogos.new' | t }}</button>
      }
    </div>
    <p class="mb-5 max-w-3xl text-sm text-muted-foreground">{{ 'catalogos.hint' | t }}</p>

    <div role="tablist" [attr.aria-label]="'catalogos.listLabel' | t" class="mb-5 flex flex-wrap gap-2">
      @for (k of kinds; track k.value) {
        <button type="button" role="tab" class="chip" [attr.aria-selected]="kind() === k.value" (click)="select(k.value)">{{ k.label }}</button>
      }
    </div>

    @if (editing()) {
      <section class="panel mb-6 max-w-3xl p-5 shadow-[0_4px_16px_rgb(14_34_48/0.08)]" aria-labelledby="vtitle">
        <h2 id="vtitle" class="mb-3 text-lg">{{ editingCode() ? ('catalogos.edit' | t) : ('catalogos.new' | t) }} · {{ kindLabel() }}</h2>
        <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
          <div>
            <label for="vlabel" class="field-label">{{ 'catalogos.label' | t }}</label>
            <input id="vlabel" class="field w-full" [formField]="model.label" (input)="autoCode()" />
          </div>
          <div>
            <label for="vcode" class="field-label">{{ 'catalogos.code' | t }}</label>
            <input id="vcode" class="field optic w-full" aria-describedby="vcode-hint" [formField]="model.code" (input)="codeTouched = true" />
            <p id="vcode-hint" class="mt-1 text-xs text-muted-foreground">{{ editingCode() ? ('catalogos.codeLocked' | t) : ('catalogos.codeHint' | t) }}</p>
          </div>
          @if (isColor()) {
            <div class="sm:col-span-2">
              <label for="vswatch" class="field-label">{{ 'catalogos.swatch' | t }}</label>
              <div class="flex flex-wrap items-center gap-3">
                <span class="size-10 shrink-0 rounded-full border border-border" [style.background]="preview()" role="img" [attr.aria-label]="'catalogos.swatchPreview' | t"></span>
                <input id="vswatch" class="field optic min-w-0 flex-1" aria-describedby="vswatch-hint" placeholder="#1a1a1a" [formField]="model.swatch" />
                <label class="btn btn-secondary">
                  <input type="color" class="size-5 cursor-pointer border-0 bg-transparent p-0" [value]="pickerValue()" (input)="pickColor($event)" />
                  {{ 'catalogos.pickColor' | t }}
                </label>
              </div>
              <p id="vswatch-hint" class="mt-1 text-xs text-muted-foreground">{{ 'catalogos.swatchHint' | t }}</p>
            </div>
          }
          @if (error()) { <p role="alert" class="alert-error sm:col-span-2">{{ error() }}</p> }
          <div class="flex flex-wrap gap-2 border-t border-border pt-4 sm:col-span-2">
            <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ 'common.save' | t }}</button>
            <button type="button" class="btn btn-secondary" (click)="editing.set(false)">{{ 'common.cancel' | t }}</button>
          </div>
        </form>
      </section>
    }

    <section [attr.aria-labelledby]="'k-' + kind()">
      <h2 [id]="'k-' + kind()" class="mb-1 text-lg">{{ kindLabel() }}</h2>
      <p class="mb-3 max-w-3xl text-sm text-muted-foreground">{{ fixed() ? ('catalogos.fixedHint' | t) : ('catalogos.openHint' | t) }}</p>
      @if (loadError()) { <p role="alert" class="alert-error mb-4">{{ loadError() }}</p> }
      @if (rowError()) { <p role="alert" class="alert-error mb-4">{{ rowError() }}</p> }
      <div class="panel overflow-x-auto">
        <table class="data-table stack">
          <thead>
            <tr>
              <th scope="col">{{ 'catalogos.labelColumn' | t }}</th>
              <th scope="col">{{ 'catalogos.code' | t }}</th>
              <th scope="col" class="text-right">{{ 'catalogos.products' | t }}</th>
              <th scope="col">{{ 'common.status' | t }}</th>
              <th scope="col"><span class="sr-only">{{ 'common.edit' | t }}</span></th>
            </tr>
          </thead>
          <tbody>
            @for (v of values(); track v.code; let i = $index) {
              <tr>
                <td class="font-medium">
                  <span class="inline-flex items-center gap-2">
                    @if (v.swatch) { <span class="size-4 shrink-0 rounded-full border border-border" [style.background]="v.swatch" aria-hidden="true"></span> }
                    {{ v.label }}
                  </span>
                </td>
                <td class="optic text-muted-foreground" [attr.data-label]="'catalogos.code' | t">{{ v.code }}</td>
                <td class="text-right tabular-nums" [attr.data-label]="'catalogos.products' | t">{{ v.product_count ?? 0 }}</td>
                <td [attr.data-label]="'common.status' | t">
                  <span class="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <span class="pill"><span class="size-1.5 rounded-full" [class]="v.active ? 'bg-good' : 'bg-muted-foreground'" aria-hidden="true"></span>{{ v.active ? ('catalogos.visible' | t) : ('catalogos.hidden' | t) }}</span>
                    @if (v.system) { <span class="pill bg-secondary">{{ 'catalogos.system' | t }}</span> }
                  </span>
                </td>
                <td class="actions">
                  <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveUp' | t: { name: v.label }" [disabled]="i === 0 || busy()" (click)="shift(i, -1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
                  <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveDown' | t: { name: v.label }" [disabled]="i === values().length - 1 || busy()" (click)="shift(i, 1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
                  <button type="button" class="link" [attr.aria-label]="'catalogos.editLabel' | t: { label: v.label }" (click)="startEdit(v)">{{ 'common.edit' | t }}</button>
                  <button type="button" class="link" [disabled]="busy()" [attr.aria-label]="(v.active ? 'catalogos.hideLabel' : 'catalogos.showLabel') | t: { label: v.label }" (click)="toggle(v)">{{ v.active ? ('catalogos.hide' | t) : ('catalogos.show' | t) }}</button>
                  @if (deletable(v)) {
                    <button type="button" class="link" [disabled]="busy()" [attr.aria-label]="'catalogos.deleteLabel' | t: { label: v.label }" (click)="remove(v)">{{ 'homeAdmin.delete' | t }}</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">{{ 'catalogos.empty' | t }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export default class Catalogos implements OnInit {
  private readonly api = inject(DefaultService);
  private readonly store = inject(CatalogStore);

  protected readonly kinds = CATALOG_KINDS.map((value) => ({ value, label: KIND_LABEL[value] }));
  protected readonly kind = signal<CatalogKind>(CatalogKind.frame_shape);
  protected readonly kindLabel = computed(() => KIND_LABEL[this.kind()]);
  protected readonly fixed = computed(() => isFixedCatalog(this.kind()));
  protected readonly isColor = computed(() => this.kind() === CatalogKind.frame_color);
  protected readonly values = computed(() => this.store.values(this.kind()));
  protected readonly deletable = canDelete;

  protected readonly editing = signal(false);
  protected readonly editingCode = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly rowError = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected codeTouched = false;

  private readonly state = signal<CatalogValueForm>(empty());
  protected readonly model = form(this.state, (f) => {
    required(f.label);
    maxLength(f.label, MAX_CATALOG_LABEL);
    maxLength(f.code, 40);
    // El código no cambia después de creado (SPEC 16, punto 6).
    readonly(f.code, () => this.editingCode() !== null);
  });
  protected readonly preview = computed(() => normalizeSwatch(this.state().swatch) ?? 'transparent');
  /** El selector nativo solo entiende #rrggbb: con un degradado muestra su primer color. */
  protected readonly pickerValue = computed(() => /#[0-9a-f]{6}/i.exec(this.state().swatch)?.[0].toLowerCase() ?? '#000000');

  async ngOnInit() {
    // Siempre se pide de nuevo: los conteos de uso cambian al editar productos.
    if (!(await this.store.load(true))) this.loadError.set(this.store.error());
  }

  protected select(kind: CatalogKind) {
    this.kind.set(kind);
    this.editing.set(false);
    this.rowError.set(null);
  }

  protected startCreate() {
    this.editingCode.set(null);
    this.codeTouched = false;
    this.state.set(empty());
    this.error.set(null);
    this.editing.set(true);
  }

  protected startEdit(v: CatalogValue) {
    this.editingCode.set(v.code);
    this.codeTouched = true;
    this.state.set({ label: v.label, code: v.code, swatch: v.swatch ?? '' });
    this.error.set(null);
    this.editing.set(true);
  }

  protected autoCode() {
    if (!this.codeTouched && !this.editingCode()) this.state.update((s) => ({ ...s, code: catalogCode(s.label) }));
  }

  protected pickColor(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.state.update((s) => ({ ...s, swatch: value }));
  }

  protected async save(event: Event) {
    event.preventDefault();
    const kind = this.kind();
    const code = this.editingCode();
    const s = this.state();
    const body = code ? catalogValuePatch(kind, s) : catalogValueInput(kind, s);
    if (typeof body === 'string') return this.error.set(body);
    this.busy.set(true);
    this.error.set(null);
    try {
      const request = code
        ? this.api.adminUpdateCatalogValue(kind, code, body)
        : this.api.adminCreateCatalogValue(kind, { ...body, label: body.label ?? s.label.trim() });
      const saved = await firstValueFrom(request);
      this.store.upsert(kind, saved);
      this.editing.set(false);
    } catch (e) {
      this.error.set(problemMessage(e, t('catalogos.saveFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggle(v: CatalogValue) {
    const kind = this.kind();
    this.busy.set(true);
    this.rowError.set(null);
    try {
      this.store.upsert(kind, await firstValueFrom(this.api.adminUpdateCatalogValue(kind, v.code, { active: !v.active })));
    } catch (e) {
      this.rowError.set(problemMessage(e, t('catalogos.updateFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async shift(index: number, dir: -1 | 1) {
    const kind = this.kind();
    const codes = move(this.values(), index, dir).map((v) => v.code);
    this.busy.set(true);
    this.rowError.set(null);
    try {
      this.store.setKind(kind, (await firstValueFrom(this.api.adminReorderCatalog(kind, { codes }))).items);
    } catch (e) {
      this.rowError.set(problemMessage(e, t('common.reorderFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(v: CatalogValue) {
    if (!confirm(t('catalogos.confirmDelete', { label: v.label }))) return;
    const kind = this.kind();
    this.busy.set(true);
    this.rowError.set(null);
    try {
      await firstValueFrom(this.api.adminDeleteCatalogValue(kind, v.code));
      this.store.remove(kind, v.code);
    } catch (e) {
      // 409: es de sistema o lo usa algún producto; la API dice cuántos ("Lo usan N productos: ocúltalo en su lugar").
      this.rowError.set(problemMessage(e, t('catalogos.deleteFailed')));
    } finally {
      this.busy.set(false);
    }
  }
}
