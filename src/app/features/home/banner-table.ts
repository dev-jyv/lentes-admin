import { Component, input, output } from '@angular/core';
import type { AdminHomeBanner, PromiseIcon } from '../../api/generated/model';
import { bannerStatus, type BannerStatus } from '../../core/banner-status';
import { utcToCdmxInput } from '../../core/cdmx-time';
import { t, TPipe } from '../../core/i18n';
import { PromiseIconView } from '../../shared/promise-icon';

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

/** Tabla de banners de una ubicación: estado calculado, vigencia, orden y acciones. */
@Component({
  selector: 'app-banner-table',
  imports: [TPipe, PromiseIconView],
  template: `
    <div class="panel overflow-x-auto">
      <table class="data-table stack">
        @if (caption()) { <caption>{{ caption() }}</caption> }
        <thead><tr><th scope="col">{{ 'homeAdmin.bannerTitle' | t }}</th><th scope="col">{{ 'common.status' | t }}</th><th scope="col">{{ 'homeAdmin.validity' | t }}</th><th scope="col"><span class="sr-only">{{ 'common.edit' | t }}</span></th></tr></thead>
        <tbody>
          @for (b of items(); track b.id; let i = $index) {
            <tr>
              <td class="font-medium">
                <span class="inline-flex items-center gap-2">
                  @if (b.icon) { <app-promise-icon class="size-5 text-primary" [icon]="iconOf(b)" /> }
                  {{ name()(b) }}
                </span>
                @if (detail()(b); as d) { <span class="block text-xs font-normal text-muted-foreground">{{ d }}</span> }
              </td>
              <td [attr.data-label]="'common.status' | t">
                <span class="inline-flex flex-wrap items-center justify-end gap-1.5">
                  <span class="pill"><span class="size-1.5 rounded-full" [class]="tone(b)" aria-hidden="true"></span>{{ status(b) }}</span>
                  @if (shown().has(b.id)) { <span class="pill bg-secondary font-semibold">{{ 'homeAdmin.shown' | t }}</span> }
                </span>
              </td>
              <td class="text-muted-foreground" [attr.data-label]="'homeAdmin.validity' | t">{{ range(b) }}</td>
              <td class="actions">
                @if (reorderable()) {
                  <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveUp' | t: { name: name()(b) }" [disabled]="i === 0" (click)="shift.emit({ index: i, dir: -1 })"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
                  <button type="button" class="btn btn-secondary btn-icon" [attr.aria-label]="'micas.moveDown' | t: { name: name()(b) }" [disabled]="i === items().length - 1" (click)="shift.emit({ index: i, dir: 1 })"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
                }
                <button type="button" class="link" (click)="edit.emit(b)">{{ 'common.edit' | t }}</button>
                <button type="button" class="link" (click)="remove.emit(b)">{{ 'homeAdmin.delete' | t }}</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="empty">{{ 'homeAdmin.noBanners' | t }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class BannerTable {
  readonly items = input.required<AdminHomeBanner[]>();
  readonly shown = input.required<Set<string>>();
  readonly caption = input<string>('');
  readonly reorderable = input(true);
  /** Nombre visible de cada fila (una celda del mosaico con foto no tiene título: se muestra su celda). */
  readonly name = input<(b: AdminHomeBanner) => string>((b) => b.title);
  /** Texto secundario opcional bajo el nombre. */
  readonly detail = input<(b: AdminHomeBanner) => string | null>(() => null);

  readonly edit = output<AdminHomeBanner>();
  readonly remove = output<AdminHomeBanner>();
  readonly shift = output<{ index: number; dir: -1 | 1 }>();

  protected status = (b: AdminHomeBanner) => STATUS_LABEL[bannerStatus(b)];
  protected tone = (b: AdminHomeBanner) => STATUS_DOT[bannerStatus(b)];
  protected iconOf = (b: AdminHomeBanner) => b.icon as PromiseIcon;
  protected range = (b: AdminHomeBanner) =>
    t('homeAdmin.range', { start: utcToCdmxInput(b.starts_at).replace('T', ' ') || t('homeAdmin.noStart'), end: utcToCdmxInput(b.ends_at).replace('T', ' ') || t('homeAdmin.noEnd') });
}
