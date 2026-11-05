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
    <h1 class="page-title mb-6">{{ 'nav.marcas' | t }}</h1>
    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="min-w-0">
        @if (loadError()) { <p role="alert" class="alert-error mb-4">{{ loadError() }}</p> }
        <div class="panel overflow-x-auto">
          <table class="data-table">
            <thead><tr><th scope="col">{{ 'common.name' | t }}</th><th scope="col">{{ 'common.slug' | t }}</th></tr></thead>
            <tbody>
              @for (b of brands(); track b.id) {
                <tr><td class="font-medium">{{ b.name }}</td><td class="optic text-muted-foreground">{{ b.slug }}</td></tr>
              } @empty {
                <tr><td colspan="2" class="empty">{{ 'marcas.empty' | t }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <section class="panel space-y-4 p-5 lg:sticky lg:top-8 max-lg:order-first" aria-labelledby="new-brand">
        <h2 id="new-brand" class="text-lg">{{ 'marcas.new' | t }}</h2>
        <form class="space-y-4" (submit)="create($event)">
          <div>
            <label for="name" class="field-label">{{ 'common.name' | t }}</label>
            <input id="name" class="field w-full" [formField]="model.name" (input)="autoSlug()" />
          </div>
          <div>
            <label for="slug" class="field-label">{{ 'marcas.slugUrl' | t }}</label>
            <input id="slug" class="field w-full" [formField]="model.slug" />
          </div>
          @if (error()) { <p role="alert" class="alert-error">{{ error() }}</p> }
          <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ 'marcas.create' | t }}</button>
        </form>
      </section>
    </div>
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
