import { HttpClient } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { ProductImageAdmin } from '../../api/provisional/model';
import { ImagesService } from '../../api/provisional/images/images.service';
import { IMAGE_TYPES, move, validateImage, type ImageType } from '../../core/images';
import { problemMessage } from '../../core/problem';

@Component({
  selector: 'app-imagenes',
  imports: [RouterLink],
  template: `
    <a routerLink="/productos" class="text-sm underline">← Productos</a>
    <h1 class="my-4 text-2xl">Imágenes del producto</h1>
    <p class="mb-4 text-sm text-muted-foreground">La primera es la imagen principal en la tienda. JPG, PNG o WebP, máx. 5 MB cada una.</p>

    <div class="mb-6 max-w-md">
      <label for="files" class="mb-1 block text-sm">Agregar imágenes</label>
      <input id="files" type="file" multiple [accept]="accept" class="block text-sm" (change)="upload($event)" [disabled]="busy()" />
      @if (busy()) { <p role="status" class="mt-2 text-sm">Subiendo…</p> }
    </div>
    @if (loadError()) { <p role="alert" class="mb-4 text-sm text-destructive">{{ loadError() }}</p> }
    @if (errors().length) {
      <ul role="alert" class="mb-4 text-sm text-destructive">@for (e of errors(); track $index) { <li>{{ e }}</li> }</ul>
    }

    <ul class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      @for (img of images(); track img.id; let i = $index; let first = $first; let last = $last) {
        <li class="space-y-2 rounded-lg border border-border p-2">
          <img [src]="img.url" [alt]="'Imagen ' + (i + 1) + ' del producto'" class="aspect-square w-full rounded-lg bg-muted object-contain" />
          <p class="text-xs text-muted-foreground">@if (first) { <strong>Principal</strong> } @else { Posición {{ i + 1 }} }</p>
          @if (confirming() === img.id) {
            <div class="flex gap-1">
              <button type="button" class="rounded-lg bg-destructive px-2 py-1 text-xs text-destructive-foreground disabled:opacity-50" [disabled]="busy()" (click)="remove(img)">Sí, eliminar</button>
              <button type="button" class="rounded-lg border border-input px-2 py-1 text-xs" (click)="confirming.set(null)">No</button>
            </div>
          } @else {
            <div class="flex flex-wrap gap-1">
              <button type="button" class="rounded-lg border border-input px-2 py-1 text-xs disabled:opacity-40" [disabled]="first || busy()" [attr.aria-label]="'Mover imagen ' + (i + 1) + ' antes'" (click)="shift(i, -1)">←</button>
              <button type="button" class="rounded-lg border border-input px-2 py-1 text-xs disabled:opacity-40" [disabled]="last || busy()" [attr.aria-label]="'Mover imagen ' + (i + 1) + ' después'" (click)="shift(i, 1)">→</button>
              <button type="button" class="rounded-lg border border-input px-2 py-1 text-xs" (click)="confirming.set(img.id)">Eliminar</button>
            </div>
          }
        </li>
      } @empty { <li class="text-sm text-muted-foreground">Este producto aún no tiene imágenes.</li> }
    </ul>
  `,
})
export default class Imagenes implements OnInit {
  /** :productId de la ruta (withComponentInputBinding). */
  readonly productId = input.required<string>();
  private readonly api = inject(ImagesService);
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
      this.loadError.set(problemMessage(e, 'No se pudieron cargar las imágenes.'));
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
        problems.push(`${file.name}: ${problemMessage(e, 'no se pudo subir.')}`);
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
      this.errors.set([problemMessage(e, 'No se pudo cambiar el orden.')]);
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
      this.errors.set([problemMessage(e, 'No se pudo eliminar.')]);
    } finally {
      this.busy.set(false);
    }
  }
}
