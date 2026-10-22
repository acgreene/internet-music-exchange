import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { STATUS_LABELS } from '../releases/release-options';
import { StudioService } from '../studio.service';
import { ProductDetailsSection } from './sections/product-details-section';
import { ProductImagesSection } from './sections/product-images-section';
import { ShippingSection } from './sections/shipping-section';
import { VariantsSection } from './sections/variants-section';

/**
 * Everything about one product: details, variants and stock, photos,
 * shipping, and whether it is on sale.
 */
@Component({
  selector: 'ime-product-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    ProductDetailsSection,
    ProductImagesSection,
    RouterLink,
    ShippingSection,
    SpinnerComponent,
    VariantsSection,
  ],
  template: `
    @if (product.error(); as error) {
      <ime-alert tone="error">{{ error.message }}</ime-alert>
    } @else if (managed(); as managed) {
      <div class="flex max-w-4xl flex-col gap-8">
        <header class="flex flex-col gap-3">
          <a
            class="text-sm text-ink-muted hover:underline"
            [routerLink]="[
              '/studio/artists',
              managed.product.artistId,
              'merch',
            ]"
            >← Merch</a
          >
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
                {{ managed.product.name }}
              </h1>
              <span
                class="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium"
                >{{ statusLabels[managed.product.status] }}</span
              >
            </div>
            <div class="flex flex-wrap gap-2">
              @switch (managed.product.status) {
                @case ('draft') {
                  <button
                    imeButton
                    variant="danger"
                    [busy]="working() === 'delete'"
                    (click)="remove()"
                  >
                    Delete draft
                  </button>
                  <button
                    imeButton
                    [busy]="working() === 'publish'"
                    (click)="publish()"
                  >
                    Publish
                  </button>
                }
                @case ('published') {
                  @if (studio.currentArtist(); as artist) {
                    <a
                      imeButton
                      variant="secondary"
                      [routerLink]="[
                        '/artists',
                        artist.handle,
                        'merch',
                        managed.product.id,
                      ]"
                      >View page</a
                    >
                  }
                  <button
                    imeButton
                    variant="secondary"
                    [busy]="working() === 'archive'"
                    (click)="archive()"
                  >
                    Archive
                  </button>
                }
                @case ('archived') {
                  <button
                    imeButton
                    [busy]="working() === 'publish'"
                    (click)="publish()"
                  >
                    Publish again
                  </button>
                }
              }
            </div>
          </div>
          @if (managed.product.status === 'archived') {
            <ime-alert>Archived: off sale. Past orders keep it.</ime-alert>
          }
          @if (managed.product.status === 'taken_down') {
            <ime-alert tone="error"
              >Taken down by IME's moderators and pulled from the store.
              Unshipped orders were refunded. The email we sent explains
              why.</ime-alert
            >
          }
          @if (confirmingDelete()) {
            <div
              class="flex flex-wrap items-center gap-3 rounded-card border border-danger/40 bg-danger/10 p-3 text-sm"
            >
              <span>Delete this draft and its photos for good?</span>
              <button
                imeButton
                variant="danger"
                size="sm"
                [busy]="working() === 'delete'"
                (click)="remove()"
              >
                Delete
              </button>
              <button
                imeButton
                variant="ghost"
                size="sm"
                (click)="confirmingDelete.set(false)"
              >
                Keep it
              </button>
            </div>
          }
          @if (error(); as message) {
            <ime-alert tone="error">{{ message }}</ime-alert>
          }
        </header>

        <ime-product-details-section
          [managed]="managed"
          (changed)="product.reload()"
        />
        <ime-variants-section
          [managed]="managed"
          (changed)="product.reload()"
        />
        <ime-product-images-section
          [managed]="managed"
          (changed)="product.reload()"
        />
        <ime-shipping-section
          [managed]="managed"
          (changed)="product.reload()"
        />
      </div>
    } @else {
      <ime-spinner />
    }
  `,
})
export class ProductEditorPage {
  private readonly api = inject(ApiClient);
  protected readonly studio = inject(StudioService);
  private readonly router = inject(Router);

  public readonly productId = input.required<string>();

  protected readonly product = resource({
    params: () => this.productId(),
    loader: async ({ params }) => unwrap(await this.api.merch.get(params)),
  });
  protected readonly managed = computed(() => currentValue(this.product));

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly working = signal<'publish' | 'archive' | 'delete' | null>(
    null,
  );
  protected readonly confirmingDelete = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const artistId = this.managed()?.product.artistId;
      if (artistId) this.studio.currentArtistId.set(artistId);
    });
  }

  protected async publish(): Promise<void> {
    await this.act('publish', () => this.api.merch.publish(this.productId()));
  }

  protected async archive(): Promise<void> {
    await this.act('archive', () => this.api.merch.archive(this.productId()));
  }

  protected async remove(): Promise<void> {
    if (!this.confirmingDelete()) {
      this.confirmingDelete.set(true);
      return;
    }
    const artistId = this.managed()?.product.artistId;
    const done = await this.act('delete', () =>
      this.api.merch.delete(this.productId()),
    );
    if (done && artistId)
      await this.router.navigate(['/studio/artists', artistId, 'merch']);
  }

  private async act(
    kind: 'publish' | 'archive' | 'delete',
    call: () => Promise<ApiResult<unknown>>,
  ): Promise<boolean> {
    this.working.set(kind);
    this.error.set(null);
    const result = await call();
    this.working.set(null);
    if (!result.ok) {
      this.error.set(result.error.message);
      return false;
    }
    if (kind !== 'delete') this.product.reload();
    return true;
  }
}
