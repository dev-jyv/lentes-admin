import { HttpClient } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../../api/generated/default/default.service';
import type { ProductImageAdmin } from '../../api/generated/model';
import { IMAGE_TYPES, move, validateImage, type ImageType } from '../../core/images';
import { problemMessage } from '../../core/problem';
import { t, TPipe } from '../../core/i18n';

@Component({
  selector: 'app-imagenes',
  imports: [RouterLink, TPipe],
  template: `
    <a routerLink="/productos" class="back-link">{{ 'imagenes.back' | t }}</a>
    <h1 class="page-title my-4">{{ 'imagenes.title' | t }}</h1>
    <p class="mb-6 text-sm text-muted-foreground">{{ 'imagenes.hint' | t }}</p>

    <div class="panel mb-6 max-w-xl border-dashed p-5">
      <label for="files" class="field-label">{{ 'imagenes.add' | t }}</label>
      <input id="files" type="file" multiple [accept]="accept" class="block" (change)="upload($event)" [disabled]="busy()" />
      @if (busy()) { <p role="status" class="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><span class="size-3 animate-pulse rounded-full bg-primary" aria-hidden="true"></span>{{ 'imagenes.uploading' | t }}</p> }
    </div>
    @if (loadError()) { <p role="alert" class="alert-error mb-4">{{ loadError() }}</p> }
    @if (errors().length) {
      <ul role="alert" class="alert-error mb-4 list-disc pl-8">@for (e of errors(); track $index) { <li>{{ e }}</li> }</ul>
    }

    <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      @for (img of images(); track img.id; let i = $index; let first = $first; let last = $last) {
        <li class="panel space-y-3 p-2 pb-3">
          <img [src]="img.url" [alt]="'imagenes.alt' | t: { position: i + 1 }" class="aspect-square w-full rounded-lg bg-muted object-contain" />
          <p class="px-1 text-xs text-muted-foreground">@if (first) { <span class="pill bg-secondary font-semibold text-foreground">{{ 'imagenes.main' | t }}</span> } @else { {{ 'imagenes.position' | t: { position: i + 1 } }} }</p>
          @if (confirming() === img.id) {
            <div class="flex flex-wrap gap-1.5 px-1">
              <button type="button" class="btn btn-danger btn-sm" [disabled]="busy()" (click)="remove(img)">{{ 'imagenes.confirmDelete' | t }}</button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="confirming.set(null)">{{ 'common.no' | t }}</button>
            </div>
          } @else {
            <div class="flex flex-wrap gap-1.5 px-1">
              <button type="button" class="btn btn-secondary btn-icon" [disabled]="first || busy()" [attr.aria-label]="'imagenes.moveBefore' | t: { position: i + 1 }" (click)="shift(i, -1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
              <button type="button" class="btn btn-secondary btn-icon" [disabled]="last || busy()" [attr.aria-label]="'imagenes.moveAfter' | t: { position: i + 1 }" (click)="shift(i, 1)"><svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="confirming.set(img.id)">{{ 'common.delete' | t }}</button>
            </div>
          }
        </li>
      } @empty { <li class="col-span-full rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">{{ 'imagenes.empty' | t }}</li> }
    </ul>
  `,
})
export default class Imagenes implements OnInit {
  /** :productId de la ruta (withComponentInputBinding). */
  readonly productId = input.required<string>();
  private readonly api = inject(DefaultService);
  private readonly http = inject(HttpClient);
  protected readonly images = signal<ProductImageAdmin[]>([]);
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly confirming = signal<string | null>(null);
  protected readonly accept = IMAGE_TYPES.join(',');

  ngOnInit() {
    return this.load();
  }

  private async load() {
    try {
      this.images.set((await firstValueFrom(this.api.adminListProductImages(this.productId()))).items);
      this.loadError.set(null);
    } catch (e) {
      this.loadError.set(problemMessage(e, t('imagenes.loadFailed')));
    }
  }

  protected async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.errors.set([]);
    const problems: string[] = [];
    this.busy.set(true);
    for (const file of files) {
      const invalid = validateImage(file);
      if (invalid) { problems.push(invalid); continue; }
      try {
        // 1) URL prefirmada  2) PUT directo a R2 (sin Bearer: no empieza con /v1)  3) registrar en la galería
        const { upload_url, r2_key } = await firstValueFrom(
          this.api.adminCreateImageUploadUrl({ product_id: this.productId(), content_type: file.type as ImageType, size_bytes: file.size }),
        );
        await firstValueFrom(this.http.put(upload_url, file, { headers: { 'Content-Type': file.type } }));
        await firstValueFrom(this.api.adminAddProductImage(this.productId(), { r2_key }));
      } catch (e) {
        problems.push(t('imagenes.uploadFailed', { name: file.name, message: problemMessage(e, t('imagenes.uploadFailedFallback')) }));
      }
    }
    this.errors.set(problems);
    await this.load();
    this.busy.set(false);
  }

  protected async shift(index: number, dir: -1 | 1) {
    const ids = move(this.images().map((i) => i.id), index, dir);
    this.busy.set(true);
    try {
      this.images.set((await firstValueFrom(this.api.adminReorderProductImages(this.productId(), { image_ids: ids }))).items);
    } catch (e) {
      this.errors.set([problemMessage(e, t('common.reorderFailed'))]);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(img: ProductImageAdmin) {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.adminDeleteProductImage(this.productId(), img.id));
      this.confirming.set(null);
      await this.load();
    } catch (e) {
      this.errors.set([problemMessage(e, t('imagenes.deleteFailed'))]);
    } finally {
      this.busy.set(false);
    }
  }
}
