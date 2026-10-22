import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { CartService, currentValue } from '@ime/client-data';
import { ApiError, HttpStatus } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';
import { PageMetaService } from '../page-meta';
import { productTypeLabel } from './merch-labels';

/** The most units of one variant offered at once. */
const MAX_QUANTITY = 10;

/**
 * A piece of merch, `/artists/<handle>/merch/<id>`: its photos, the variant
 * the buyer picks, stock, price, and shipping.
 */
@Component({
  selector: 'ime-product-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    MoneyPipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (page.error(); as error) {
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ isNotFound(error) ? 'Not found' : 'Something went wrong' }}
        </h1>
        <p class="text-ink-muted">
          {{
            isNotFound(error)
              ? 'It may be sold out for good, or the address is mistyped.'
              : 'This could not be loaded. Try again in a moment.'
          }}
        </p>
      </div>
    } @else if (product(); as page) {
      <div class="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
        <div class="flex flex-col gap-3">
          <ime-cover
            class="w-full"
            [src]="shownImage()?.url ?? null"
            [alt]="shownImage()?.altText ?? page.product.name"
          />
          @if (page.images.length > 1) {
            <div class="flex flex-wrap gap-2">
              @for (image of page.images; track image.id) {
                <button
                  class="w-16 rounded-control border-2"
                  [class.border-ink]="image.id === shownImage()?.id"
                  [class.border-transparent]="image.id !== shownImage()?.id"
                  [attr.aria-label]="'Show ' + (image.altText || 'photo')"
                  (click)="imageId.set(image.id)"
                >
                  <ime-cover [src]="image.url" [alt]="image.altText ?? ''" />
                </button>
              }
            </div>
          }
        </div>

        <div class="flex flex-col gap-5">
          <header class="flex flex-col gap-1">
            <p class="text-sm text-ink-muted">{{ typeLabel() }}</p>
            <h1 class="text-3xl font-semibold tracking-tight">
              {{ page.product.name }}
            </h1>
            <p>
              by
              <a
                class="font-medium hover:underline"
                [routerLink]="['/artists', page.artist.handle]"
                >{{ page.artist.name }}</a
              >
            </p>
          </header>

          @if (variant(); as variant) {
            <p class="text-2xl font-semibold">
              {{ variant.price | money: page.product.currency }}
            </p>
          }

          @for (option of page.options; track option; let axis = $index) {
            <fieldset class="flex flex-col gap-2">
              <legend class="text-sm font-medium">{{ option }}</legend>
              <div class="flex flex-wrap gap-2">
                @for (value of valuesFor(axis); track value) {
                  <button
                    imeButton
                    size="sm"
                    [variant]="
                      chosen()[axis] === value ? 'primary' : 'secondary'
                    "
                    [attr.aria-pressed]="chosen()[axis] === value"
                    (click)="choose(axis, value)"
                  >
                    {{ value }}
                  </button>
                }
              </div>
            </fieldset>
          }

          @if (variant(); as variant) {
            @if (variant.stock === 0) {
              <p class="font-medium text-danger">Sold out</p>
            } @else {
              @if (variant.stock <= 5) {
                <p class="text-sm text-ink-muted">
                  Only {{ variant.stock }} left
                </p>
              }
              <div class="flex items-end gap-3">
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Quantity
                  <select
                    class="h-10 rounded-control border border-line bg-canvas px-2"
                    (change)="onQuantity($event)"
                  >
                    @for (count of quantities(); track count) {
                      <option [value]="count" [selected]="count === quantity()">
                        {{ count }}
                      </option>
                    }
                  </select>
                </label>
                <button imeButton (click)="addToCart()">Add to cart</button>
                @if (added()) {
                  <a imeButton variant="secondary" routerLink="/cart"
                    >View cart</a
                  >
                }
              </div>
            }
          } @else if (page.options.length) {
            <p class="text-sm text-ink-muted">
              That combination is not available.
            </p>
          }

          @if (page.product.includesDigital && page.release; as release) {
            <ime-alert>
              Includes the digital album:
              <a
                class="underline"
                [routerLink]="['/artists', page.artist.handle, release.slug]"
                >{{ release.title }}</a
              >, in your library as soon as you pay.
            </ime-alert>
          } @else if (page.release; as release) {
            <p class="text-sm">
              An edition of
              <a
                class="underline"
                [routerLink]="['/artists', page.artist.handle, release.slug]"
                >{{ release.title }}</a
              >.
            </p>
          }

          @if (page.product.description; as description) {
            <p class="max-w-prose whitespace-pre-line">{{ description }}</p>
          }

          @if (page.shippingRates.length) {
            <section
              class="flex flex-col gap-1 text-sm"
              aria-labelledby="shipping-heading"
            >
              <h2 id="shipping-heading" class="font-medium">Shipping</h2>
              @for (rate of page.shippingRates; track rate.destination) {
                <p class="text-ink-muted">
                  {{
                    rate.destination === 'domestic'
                      ? 'In the artist’s country'
                      : 'Everywhere else'
                  }}: {{ rate.firstItemAmount | money: page.product.currency }},
                  then
                  {{ rate.additionalItemAmount | money: page.product.currency }}
                  for each additional one
                </p>
              }
            </section>
          }
        </div>
      </div>
    } @else {
      <ime-spinner />
    }
  `,
})
export class ProductPage {
  private readonly api = inject(ApiClient);
  private readonly cart = inject(CartService);
  private readonly meta = inject(PageMetaService);

  public readonly handle = input.required<string>();
  public readonly productId = input.required<string>();

  protected readonly page = resource({
    id: 'product-page',
    params: () => this.productId(),
    loader: async ({ params }) =>
      unwrap(await this.api.merch.getProductPage(params)),
  });
  protected readonly product = computed(() => currentValue(this.page));

  /** The value picked on each option axis, starting from the first in stock. */
  protected readonly chosen = linkedSignal<string[]>(() => {
    const page = this.product();
    const first =
      page?.variants.find((variant) => variant.stock > 0) ?? page?.variants[0];
    return first?.options ?? [];
  });
  protected readonly variant = computed(() =>
    this.product()?.variants.find((variant) =>
      variant.options.every((value, axis) => value === this.chosen()[axis]),
    ),
  );

  protected readonly imageId = linkedSignal<string | null>(() => {
    const images = this.product()?.images ?? [];
    const variantId = this.variant()?.id;
    return (
      (images.find((image) => image.variantId === variantId) ?? images[0])
        ?.id ?? null
    );
  });
  protected readonly shownImage = computed(() =>
    this.product()?.images.find((image) => image.id === this.imageId()),
  );

  protected readonly quantity = linkedSignal<number>(() =>
    this.variant() ? 1 : 0,
  );
  protected readonly quantities = computed(() =>
    Array.from(
      { length: Math.min(this.variant()?.stock ?? 0, MAX_QUANTITY) },
      (_, index) => index + 1,
    ),
  );
  protected readonly added = signal(false);
  protected readonly typeLabel = computed(() => {
    const type = this.product()?.product.type;
    return type ? productTypeLabel(type) : '';
  });

  constructor() {
    effect(() => {
      if (this.isNotFound(this.page.error())) this.meta.notFound();
      const page = this.product();
      if (!page) return;
      this.meta.set({
        title: `${page.product.name} by ${page.artist.name}`,
        description:
          page.product.description?.slice(0, 200) ??
          `${productTypeLabel(page.product.type)} by ${page.artist.name}, on IME.`,
        image: page.images[0]?.url,
      });
    });
  }

  /** The values an axis offers, in the order the variants list them. */
  protected valuesFor(axis: number): string[] {
    return [
      ...new Set(
        this.product()?.variants.map((variant) => variant.options[axis]) ?? [],
      ),
    ];
  }

  protected onQuantity(event: Event): void {
    this.quantity.set(Number((event.target as HTMLSelectElement).value));
  }

  protected choose(axis: number, value: string): void {
    this.chosen.update((chosen) =>
      chosen.map((current, at) => (at === axis ? value : current)),
    );
    this.added.set(false);
  }

  protected addToCart(): void {
    const page = this.product();
    const variant = this.variant();
    if (!page || !variant) return;
    this.cart.add({
      kind: 'merch',
      variantId: variant.id,
      productId: page.product.id,
      artistId: page.artist.id,
      artistName: page.artist.name,
      artistHandle: page.artist.handle,
      currency: page.product.currency,
      name: page.product.name,
      variantLabel: variant.options.length ? variant.options.join(' / ') : null,
      imageUrl: this.shownImage()?.url ?? null,
      unitPrice: variant.price,
      quantity: this.quantity(),
      stock: variant.stock,
    });
    this.added.set(true);
  }

  protected isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === HttpStatus.NotFound;
  }
}
