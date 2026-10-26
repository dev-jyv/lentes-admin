import { Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { Brand } from '../../api/generated/model';
import { problemMessage } from '../../core/problem';
import { slugify } from '../../core/slug';

@Component({
  selector: 'app-marcas',
  imports: [FormField],
  template: `
    <h1 class="mb-6 text-2xl font-semibold">Marcas</h1>
    <section class="mb-8 max-w-md space-y-3 rounded border border-slate-200 p-4">
      <h2 class="font-medium">Nueva marca</h2>
      <form class="space-y-3" (submit)="create($event)">
        <div>
          <label for="name" class="mb-1 block text-sm">Nombre</label>
          <input id="name" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.name" (input)="autoSlug()" />
        </div>
        <div>
          <label for="slug" class="mb-1 block text-sm">Slug (URL)</label>
          <input id="slug" class="w-full rounded border border-slate-300 px-3 py-2" [formField]="model.slug" />
        </div>
        @if (error()) { <p role="alert" class="text-sm text-red-700">{{ error() }}</p> }
        <button type="submit" class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" [disabled]="busy()">Crear marca</button>
      </form>
    </section>
    @if (loadError()) { <p role="alert" class="mb-4 text-sm text-red-700">{{ loadError() }}</p> }
    <table class="w-full max-w-2xl text-sm">
      <thead><tr class="border-b text-left"><th class="py-2">Nombre</th><th>Slug</th></tr></thead>
      <tbody>
        @for (b of brands(); track b.id) {
          <tr class="border-b"><td class="py-2">{{ b.name }}</td><td class="text-slate-600">{{ b.slug }}</td></tr>
        } @empty {
          <tr><td colspan="2" class="py-4 text-slate-500">Aún no hay marcas.</td></tr>
        }
      </tbody>
    </table>
  `,
})
export default class Marcas implements OnInit {
  private readonly api = inject(DefaultService);
  protected readonly brands = signal<Brand[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  private slugTouched = false;

  private readonly state = signal({ name: '', slug: '' });
  protected readonly model = form(this.state, (f) => {
    required(f.name);
    required(f.slug);
  });

  async ngOnInit() {
    try {
      const res = await firstValueFrom(this.api.listBrands());
      this.brands.set(res.items);
    } catch (e) {
      this.loadError.set(problemMessage(e, 'No se pudieron cargar las marcas.'));
    }
  }

  protected autoSlug() {
    if (!this.slugTouched) this.state.update((s) => ({ ...s, slug: slugify(s.name) }));
  }

  protected async create(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const brand = await firstValueFrom(this.api.adminCreateBrand(this.state()));
      this.brands.update((list) => [...list, brand].sort((a, b) => a.name.localeCompare(b.name)));
      this.state.set({ name: '', slug: '' });
    } catch (e) {
      this.error.set(problemMessage(e, 'No se pudo crear la marca (¿nombre o slug repetido?).'));
    } finally {
      this.busy.set(false);
    }
  }
}
