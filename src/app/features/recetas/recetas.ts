import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { AdminPrescription, RxStatus } from '../../api/generated/model';
import { formatDate, formatDateTime } from '../../core/format';
import { problemMessage } from '../../core/problem';

const TABS: { value: RxStatus; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
];

const fmt = (n: number | null | undefined) => (n == null ? '—' : n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

@Component({
  selector: 'app-recetas',
  template: `
    <h1 class="mb-6 text-2xl">Recetas</h1>
    <div role="tablist" aria-label="Estado" class="mb-4 flex gap-2">
      @for (t of tabs; track t.value) {
        <button type="button" role="tab" [attr.aria-selected]="tab() === t.value" class="rounded-lg border px-3 py-2 text-sm" [class.bg-primary]="tab() === t.value" [class.text-primary-foreground]="tab() === t.value" [class.border-input]="tab() !== t.value" (click)="select(t.value)">{{ t.label }}</button>
      }
    </div>
    @if (error()) { <p role="alert" class="mb-4 text-sm text-destructive">{{ error() }}</p> }
    <ul class="divide-y rounded-lg border border-border">
      @for (r of items(); track r.id) {
        <li class="space-y-2 p-4 text-sm">
          <div class="flex flex-wrap justify-between gap-2">
            <div>
              <p class="font-medium">{{ r.customer_email }}</p>
              <p class="text-muted-foreground">Dr(a). {{ r.doctor_name }}@if (r.doctor_license) { · Cédula {{ r.doctor_license }} } · emitida {{ d(r.issued_at) }} · vigente hasta {{ d(r.expires_at) }}</p>
              <p class="text-xs text-muted-foreground">Subida {{ dt(r.created_at) }}</p>
            </div>
            @if (r.file_url) { <a [href]="r.file_url" target="_blank" rel="noopener noreferrer" class="underline">Ver archivo</a> }
          </div>
          <p>
            OD: esf {{ f(r.od_sphere) }} cil {{ f(r.od_cylinder) }} eje {{ r.od_axis ?? '—' }} add {{ r.od_addition ?? '—' }}<br />
            OI: esf {{ f(r.os_sphere) }} cil {{ f(r.os_cylinder) }} eje {{ r.os_axis ?? '—' }} add {{ r.os_addition ?? '—' }}
          </p>
          @if (r.status === 'rejected' && r.reject_reason) { <p class="text-destructive">Motivo: {{ r.reject_reason }}</p> }
          @if (r.status === 'pending') {
            @if (rejecting() === r.id) {
              <div class="space-y-2">
                <label [attr.for]="'reason-' + r.id" class="block">Motivo del rechazo (se le muestra al cliente)</label>
                <textarea [id]="'reason-' + r.id" rows="2" class="w-full rounded-lg border border-input px-3 py-2" [value]="reason()" (input)="reason.set(val($event))"></textarea>
                <div class="flex gap-2">
                  <button type="button" class="rounded-lg bg-destructive px-3 py-2 text-destructive-foreground disabled:opacity-50" [disabled]="busy() || !reason().trim()" (click)="review(r, 'rejected')">Rechazar</button>
                  <button type="button" class="rounded-lg border border-input px-3 py-2" (click)="rejecting.set(null)">Cancelar</button>
                </div>
              </div>
            } @else {
              <div class="flex gap-2">
                <button type="button" class="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" [disabled]="busy()" (click)="review(r, 'approved')">Aprobar</button>
                <button type="button" class="rounded-lg border border-input px-3 py-2" (click)="startReject(r.id)">Rechazar</button>
              </div>
            }
          }
        </li>
      } @empty {
        <li class="p-4 text-muted-foreground">No hay recetas en este estado.</li>
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
      this.error.set(problemMessage(e, 'No se pudieron cargar las recetas.'));
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
      this.error.set(problemMessage(e, 'No se pudo guardar la revisión.'));
    } finally {
      this.busy.set(false);
    }
  }
}
