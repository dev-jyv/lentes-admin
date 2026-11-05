import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminPrescription, RxStatus } from '../../api/generated/model';
import { formatDate, formatDateTime } from '../../core/format';
import { problemMessage } from '../../core/problem';
import { t, TPipe } from '../../core/i18n';

const TABS: { value: RxStatus; label: string }[] = [
  { value: 'pending', label: t('recetas.tabs.pending') },
  { value: 'approved', label: t('recetas.tabs.approved') },
  { value: 'rejected', label: t('recetas.tabs.rejected') },
];

const fmt = (n: number | null | undefined) => (n == null ? '—' : n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

@Component({
  selector: 'app-recetas',
  imports: [TPipe],
  template: `
    <h1 class="page-title mb-6">{{ 'nav.recetas' | t }}</h1>
    <div role="tablist" [attr.aria-label]="'common.status' | t" class="mb-4 flex gap-2 overflow-x-auto">
      @for (t of tabs; track t.value) {
        <button type="button" role="tab" [attr.aria-selected]="tab() === t.value" class="chip" (click)="select(t.value)">{{ t.label }}</button>
      }
    </div>
    @if (error()) { <p role="alert" class="alert-error mb-4">{{ error() }}</p> }
    <ul class="panel divide-y divide-border">
      @for (r of items(); track r.id) {
        <li class="space-y-4 p-4 text-sm sm:p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <p class="flex flex-wrap items-center gap-2 font-semibold">{{ r.customer_email }} <span class="pill font-medium">{{ r.kind === 'glasses' ? ('common.frames' | t) : ('common.contactLenses' | t) }}</span></p>
              <p class="text-muted-foreground">{{ 'recetas.doctor' | t: { name: r.doctor_name } }}@if (r.doctor_license) { · {{ 'recetas.license' | t: { license: r.doctor_license } }} } · {{ 'recetas.issued' | t: { date: d(r.issued_at) } }} · {{ 'recetas.validUntil' | t: { date: d(r.expires_at) } }}</p>
              <p class="text-xs text-muted-foreground">{{ 'recetas.uploaded' | t: { date: dt(r.created_at) } }}</p>
            </div>
            @if (r.file_url) { <a [href]="r.file_url" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">{{ 'pedido.viewFile' | t }}</a> }
          </div>
          <table class="w-full max-w-md overflow-hidden rounded-lg bg-muted/60 text-sm">
            <caption class="sr-only">{{ 'recetas.grid.caption' | t }}</caption>
            <thead class="text-xs text-muted-foreground">
              <tr>
                <th scope="col" class="px-3 py-2 text-left font-semibold">{{ 'recetas.grid.eye' | t }}</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">{{ 'variantes.abbr.sphere' | t }}</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">{{ 'variantes.abbr.cylinder' | t }}</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">{{ 'recetas.grid.axis' | t }}</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">{{ 'variantes.abbr.addition' | t }}</th>
              </tr>
            </thead>
            <tbody class="optic">
              <tr class="border-t border-border">
                <th scope="row" class="px-3 py-2 text-left font-sans font-semibold">{{ 'recetas.grid.od' | t }}</th>
                <td class="px-3 py-2 text-right">{{ f(r.od_sphere) }}</td><td class="px-3 py-2 text-right">{{ f(r.od_cylinder) }}</td>
                <td class="px-3 py-2 text-right">{{ r.od_axis ?? '—' }}</td><td class="px-3 py-2 text-right">{{ r.od_addition ?? '—' }}</td>
              </tr>
              <tr class="border-t border-border">
                <th scope="row" class="px-3 py-2 text-left font-sans font-semibold">{{ 'recetas.grid.os' | t }}</th>
                <td class="px-3 py-2 text-right">{{ f(r.os_sphere) }}</td><td class="px-3 py-2 text-right">{{ f(r.os_cylinder) }}</td>
                <td class="px-3 py-2 text-right">{{ r.os_axis ?? '—' }}</td><td class="px-3 py-2 text-right">{{ r.os_addition ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          @if (r.kind === 'glasses') {
            <form class="flex flex-wrap items-end gap-2" (submit)="savePd($event, r)">
              <div>
                <label [attr.for]="'pd-' + r.id" class="field-label">{{ 'recetas.pdLabel' | t }}</label>
                <input [id]="'pd-' + r.id" type="number" step="0.1" min="40" max="80" class="field w-28" [value]="r.pd_mm ?? ''" (input)="pd.set(val($event))" />
              </div>
              <button type="submit" class="btn btn-secondary" [disabled]="busy()">{{ 'common.save' | t }}</button>
              @if (!r.pd_mm) { <span class="w-full text-xs text-muted-foreground">{{ 'recetas.pdRequired' | t }}</span> }
            </form>
          }
          @if (r.status === 'rejected' && r.reject_reason) { <p class="alert-error">{{ 'recetas.reason' | t: { reason: r.reject_reason } }}</p> }
          @if (r.status === 'pending') {
            @if (rejecting() === r.id) {
              <div class="space-y-2">
                <label [attr.for]="'reason-' + r.id" class="field-label">{{ 'recetas.rejectLabel' | t }}</label>
                <textarea [id]="'reason-' + r.id" rows="2" class="field w-full" [value]="reason()" (input)="reason.set(val($event))"></textarea>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-danger" [disabled]="busy() || !reason().trim()" (click)="review(r, 'rejected')">{{ 'recetas.reject' | t }}</button>
                  <button type="button" class="btn btn-secondary" (click)="rejecting.set(null)">{{ 'common.cancel' | t }}</button>
                </div>
              </div>
            } @else {
              <div class="flex gap-2">
                <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="review(r, 'approved')">{{ 'recetas.approve' | t }}</button>
                <button type="button" class="btn btn-secondary" (click)="startReject(r.id)">{{ 'recetas.reject' | t }}</button>
              </div>
            }
          }
        </li>
      } @empty {
        <li class="px-5 py-10 text-center text-muted-foreground">{{ 'recetas.empty' | t }}</li>
      }
    </ul>
  `,
})
export default class Recetas implements OnInit {
  private readonly api = inject(DefaultService);
  protected readonly tabs = TABS;
  protected readonly tab = signal<RxStatus>('pending');
  protected readonly items = signal<AdminPrescription[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly rejecting = signal<string | null>(null);
  protected readonly reason = signal('');
  protected f = fmt;
  protected d = formatDate;
  protected dt = formatDateTime;
  protected val = (e: Event) => (e.target as HTMLTextAreaElement).value;

  ngOnInit() {
    return this.load();
  }

  protected select(t: RxStatus) {
    this.tab.set(t);
    this.rejecting.set(null);
    return this.load();
  }

  private async load() {
    try {
      const res = await firstValueFrom(this.api.adminListPrescriptions({ status: this.tab() }));
      this.items.set(res.items);
      this.error.set(null);
    } catch (e) {
      this.error.set(problemMessage(e, t('recetas.loadFailed')));
    }
  }

  protected readonly pd = signal('');

  protected async savePd(event: Event, r: AdminPrescription) {
    event.preventDefault();
    const value = Number(this.pd());
    if (!this.pd() || Number.isNaN(value)) return this.error.set(t('recetas.pdMissing'));
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.adminReviewPrescription(r.id, { pd_mm: value }));
      this.pd.set('');
      await this.load();
    } catch (e) {
      this.error.set(problemMessage(e, t('recetas.pdFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected startReject(id: string) {
    this.reason.set('');
    this.rejecting.set(id);
  }

  protected async review(r: AdminPrescription, status: 'approved' | 'rejected') {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.adminReviewPrescription(r.id, status === 'rejected' ? { status, reject_reason: this.reason().trim() } : { status }),
      );
      this.rejecting.set(null);
      await this.load();
    } catch (e) {
      this.error.set(problemMessage(e, t('recetas.reviewFailed')));
    } finally {
      this.busy.set(false);
    }
  }
}
