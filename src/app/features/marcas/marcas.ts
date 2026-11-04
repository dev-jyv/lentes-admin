import { Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { Brand } from '../../api/generated/model';
import { problemMessage } from '../../core/problem';
import { slugify } from '../../core/slug';
import { t, TPipe } from '../../core/i18n';

@Component({
  selector: 'app-marcas',
  imports: [FormField, TPipe],
  template: `
    <h1 class="mb-6 text-2xl">{{ 'nav.marcas' | t }}</h1>
    <section class="mb-8 max-w-md space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 class="font-medium">{{ 'marcas.new' | t }}</h2>
      <form class="space-y-3" (submit)="create($event)">
        <div>
          <label for="name" class="mb-1 block text-sm">{{ 'common.name' | t }}</label>
          <input id="name" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.name" (input)="autoSlug()" />
        </div>
        <div>
          <label for="slug" class="mb-1 block text-sm">{{ 'marcas.slugUrl' | t }}</label>
          <input id="slug" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.slug" />
        </div>
        @if (error()) { <p role="alert" class="text-sm text-destructive">{{ error() }}</p> }
        <button type="submit" class="rounded-full bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" [disabled]="busy()">{{ 'marcas.create' | t }}</button>
      </form>
    </section>
    @if (loadError()) { <p role="alert" class="mb-4 text-sm text-destructive">{{ loadError() }}</p> }
    <table class="w-full max-w-2xl text-sm">
      <thead><tr class="border-b text-left"><th class="py-2">{{ 'common.name' | t }}</th><th>{{ 'common.slug' | t }}</th></tr></thead>
      <tbody>
        @for (b of brands(); track b.id) {
          <tr class="border-b"><td class="py-2">{{ b.name }}</td><td class="text-muted-foreground">{{ b.slug }}</td></tr>
        } @empty {
          <tr><td colspan="2" class="py-4 text-muted-foreground">{{ 'marcas.empty' | t }}</td></tr>
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
      this.loadError.set(problemMessage(e, t('marcas.loadFailed')));
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
      this.error.set(problemMessage(e, t('marcas.createFailed')));
    } finally {
      this.busy.set(false);
    }
  }
}
