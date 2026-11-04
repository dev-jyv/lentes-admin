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
    <h1 class="mb-6 text-2xl">{{ 'nav.recetas' | t }}</h1>
    <div role="tablist" [attr.aria-label]="'common.status' | t" class="mb-4 flex gap-2">
      @for (t of tabs; track t.value) {
        <button type="button" role="tab" [attr.aria-selected]="tab() === t.value" class="rounded-full border px-3 py-2 text-sm" [class.bg-primary]="tab() === t.value" [class.text-primary-foreground]="tab() === t.value" [class.border-input]="tab() !== t.value" (click)="select(t.value)">{{ t.label }}</button>
      }
    </div>
    @if (error()) { <p role="alert" class="mb-4 text-sm text-destructive">{{ error() }}</p> }
    <ul class="divide-y rounded-2xl border border-border bg-card">
      @for (r of items(); track r.id) {
        <li class="space-y-2 p-4 text-sm">
          <div class="flex flex-wrap justify-between gap-2">
            <div>
              <p class="font-medium">{{ r.customer_email }} <span class="font-normal text-muted-foreground">· {{ r.kind === 'glasses' ? ('common.frames' | t) : ('common.contactLenses' | t) }}</span></p>
              <p class="text-muted-foreground">{{ 'recetas.doctor' | t: { name: r.doctor_name } }}@if (r.doctor_license) { · {{ 'recetas.license' | t: { license: r.doctor_license } }} } · {{ 'recetas.issued' | t: { date: d(r.issued_at) } }} · {{ 'recetas.validUntil' | t: { date: d(r.expires_at) } }}</p>
              <p class="text-xs text-muted-foreground">{{ 'recetas.uploaded' | t: { date: dt(r.created_at) } }}</p>
            </div>
            @if (r.file_url) { <a [href]="r.file_url" target="_blank" rel="noopener noreferrer" class="underline">{{ 'pedido.viewFile' | t }}</a> }
          </div>
          <p>
            {{ 'recetas.rightEye' | t: { sphere: f(r.od_sphere), cylinder: f(r.od_cylinder), axis: r.od_axis ?? '—', addition: r.od_addition ?? '—' } }}<br />
            {{ 'recetas.leftEye' | t: { sphere: f(r.os_sphere), cylinder: f(r.os_cylinder), axis: r.os_axis ?? '—', addition: r.os_addition ?? '—' } }}
          </p>
          @if (r.kind === 'glasses') {
            <form class="flex flex-wrap items-end gap-2" (submit)="savePd($event, r)">
              <div>
                <label [attr.for]="'pd-' + r.id" class="mb-1 block">{{ 'recetas.pdLabel' | t }}</label>
                <input [id]="'pd-' + r.id" type="number" step="0.1" min="40" max="80" class="w-28 rounded-lg border border-input px-3 py-2" [value]="r.pd_mm ?? ''" (input)="pd.set(val($event))" />
              </div>
              <button type="submit" class="rounded-full border border-input px-3 py-2 disabled:opacity-50" [disabled]="busy()">{{ 'common.save' | t }}</button>
              @if (!r.pd_mm) { <span class="text-xs text-muted-foreground">{{ 'recetas.pdRequired' | t }}</span> }
            </form>
          }
          @if (r.status === 'rejected' && r.reject_reason) { <p class="text-destructive">{{ 'recetas.reason' | t: { reason: r.reject_reason } }}</p> }
          @if (r.status === 'pending') {
            @if (rejecting() === r.id) {
              <div class="space-y-2">
                <label [attr.for]="'reason-' + r.id" class="block">{{ 'recetas.rejectLabel' | t }}</label>
                <textarea [id]="'reason-' + r.id" rows="2" class="w-full rounded-lg border border-input px-3 py-2" [value]="reason()" (input)="reason.set(val($event))"></textarea>
                <div class="flex gap-2">
                  <button type="button" class="rounded-full bg-destructive px-3 py-2 text-destructive-foreground disabled:opacity-50" [disabled]="busy() || !reason().trim()" (click)="review(r, 'rejected')">{{ 'recetas.reject' | t }}</button>
                  <button type="button" class="rounded-full border border-input px-3 py-2" (click)="rejecting.set(null)">{{ 'common.cancel' | t }}</button>
                </div>
              </div>
            } @else {
              <div class="flex gap-2">
                <button type="button" class="rounded-full bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" [disabled]="busy()" (click)="review(r, 'approved')">{{ 'recetas.approve' | t }}</button>
                <button type="button" class="rounded-full border border-input px-3 py-2" (click)="startReject(r.id)">{{ 'recetas.reject' | t }}</button>
              </div>
            }
          }
        </li>
      } @empty {
        <li class="p-4 text-muted-foreground">{{ 'recetas.empty' | t }}</li>
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
