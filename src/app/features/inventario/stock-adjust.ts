import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { ManualStockReason, StockAdjustment, StockReason } from '../../api/generated/model';
import { formatDateTime } from '../../core/format';
import { problemMessage } from '../../core/problem';
import { MANUAL_REASONS, REASON_LABEL, validateAdjustment } from '../../core/stock';

@Component({
  selector: 'app-stock-adjust',
  template: `
    <section class="space-y-3 rounded-lg border border-border p-4" [attr.aria-label]="'Ajustar existencia de ' + sku()">
      <h3 class="font-medium">Ajustar existencia · {{ sku() }} <span class="font-normal text-muted-foreground">(hay {{ stock() }})</span></h3>
      <form class="grid gap-3 sm:grid-cols-3" (submit)="save($event)">
        <div>
          <label [attr.for]="'delta-' + variantId()" class="mb-1 block text-sm">Cantidad (+ suma, − resta)</label>
          <input [id]="'delta-' + variantId()" type="number" step="1" class="w-full rounded-lg border border-input px-3 py-2" [value]="delta() ?? ''" (input)="setDelta($event)" />
        </div>
        <div>
          <label [attr.for]="'reason-' + variantId()" class="mb-1 block text-sm">Motivo</label>
          <select [id]="'reason-' + variantId()" class="w-full rounded-lg border border-input px-3 py-2" (change)="reason.set(asReason($event))">
            @for (r of reasons; track r.value) { <option [value]="r.value" [selected]="r.value === reason()">{{ r.label }}</option> }
          </select>
        </div>
        <div>
          <label [attr.for]="'note-' + variantId()" class="mb-1 block text-sm">Nota @if (reason() === 'other') { (obligatoria) }</label>
          <input [id]="'note-' + variantId()" class="w-full rounded-lg border border-input px-3 py-2" [value]="note()" (input)="note.set(val($event))" />
        </div>
        @if (error()) { <p role="alert" class="text-sm text-destructive sm:col-span-3">{{ error() }}</p> }
        @if (ok()) { <p role="status" class="text-sm sm:col-span-3">{{ ok() }}</p> }
        <div class="flex gap-2 sm:col-span-3">
          <button type="submit" class="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" [disabled]="busy()">Registrar ajuste</button>
          <button type="button" class="rounded-lg border border-input px-3 py-2 text-sm" (click)="toggleHistory()">{{ showHistory() ? 'Ocultar historial' : 'Ver historial' }}</button>
          <button type="button" class="rounded-lg border border-input px-3 py-2 text-sm" (click)="closed.emit()">Cerrar</button>
        </div>
      </form>
      @if (showHistory()) {
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left"><th class="py-1">Fecha</th><th>Cambio</th><th>Quedó</th><th>Motivo</th><th>Quién</th></tr></thead>
          <tbody>
            @for (a of history(); track a.id) {
              <tr class="border-b">
                <td class="py-1">{{ dt(a.created_at) }}</td>
                <td [class.text-destructive]="a.delta < 0">{{ a.delta > 0 ? '+' : '' }}{{ a.delta }}</td>
                <td>{{ a.stock_after }}</td>
                <td>{{ label(a.reason) }}@if (a.note) { <span class="text-muted-foreground"> · {{ a.note }}</span> }</td>
                <td>{{ a.actor_email }}</td>
              </tr>
            } @empty { <tr><td colspan="5" class="py-2 text-muted-foreground">Sin ajustes registrados.</td></tr> }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class StockAdjust {
  readonly variantId = input.required<string>();
  readonly sku = input.required<string>();
  readonly stock = input.required<number>();
  /** Nueva existencia tras un ajuste exitoso. */
  readonly adjusted = output<number>();
  readonly closed = output<void>();

  private readonly api = inject(DefaultService);
  protected readonly delta = signal<number | null>(null);
  protected readonly reason = signal<ManualStockReason>('receipt');
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly ok = signal<string | null>(null);
  protected readonly showHistory = signal(false);
  protected readonly history = signal<StockAdjustment[]>([]);

  protected readonly reasons = MANUAL_REASONS.map((value) => ({ value, label: REASON_LABEL[value] }));
  protected label = (r: StockReason) => REASON_LABEL[r];
  protected dt = formatDateTime;
  protected val = (e: Event) => (e.target as HTMLInputElement).value;
  protected asReason = (e: Event) => (e.target as HTMLSelectElement).value as ManualStockReason;

  protected setDelta(e: Event) {
    const v = this.val(e);
    this.delta.set(v === '' ? null : Number(v));
  }

  protected async toggleHistory() {
    this.showHistory.update((v) => !v);
    if (this.showHistory()) await this.loadHistory();
  }

  private async loadHistory() {
    try {
      this.history.set((await firstValueFrom(this.api.adminListStockAdjustments(this.variantId()))).items);
    } catch (e) {
      this.error.set(problemMessage(e, 'No se pudo cargar el historial.'));
    }
  }

  protected async save(event: Event) {
    event.preventDefault();
    this.ok.set(null);
    const invalid = validateAdjustment(this.delta(), this.reason(), this.note(), this.stock());
    if (invalid) return this.error.set(invalid);
    this.busy.set(true);
    this.error.set(null);
    try {
      const adj = await firstValueFrom(
        this.api.adminCreateStockAdjustment(this.variantId(), {
          delta: this.delta()!, reason: this.reason(), ...(this.note().trim() ? { note: this.note().trim() } : {}),
        }),
      );
      this.adjusted.emit(adj.stock_after);
      this.ok.set(`Listo. Existencia: ${adj.stock_after}.`);
      this.delta.set(null);
      this.note.set('');
      if (this.showHistory()) await this.loadHistory();
    } catch (e) {
      this.error.set(problemMessage(e, 'No se pudo registrar el ajuste.'));
    } finally {
      this.busy.set(false);
    }
  }
}
