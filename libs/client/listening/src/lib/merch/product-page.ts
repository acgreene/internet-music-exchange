import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { CartService, SessionService, currentValue } from '@ime/client-data';
import { ApiError, HttpStatus } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  MoneyPipe,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';
import { type MenuAction, MoreMenu } from '../more-menu';
import { PageMetaService } from '../page-meta';
import { ReleaseArtistCard } from '../releases/release-artist-card';
import { discographySubtitle, newestFirst } from '../releases/release-labels';
import { openReport } from '../reporting/report-button';
import { MerchGrid } from './merch-grid';
import { productTypeLabel } from './merch-labels';

/** The most units of one variant offered at once. */
const MAX_QUANTITY = 10;
/** The artist's other merch shown below. */
const MORE_MERCH = 4;
/** The artist's releases shown below. */
const MORE_MUSIC = 6;

/**
 * A piece of merch, `/artists/<handle>/merch/<id>`: its photos, the variant
 * the buyer picks, stock, price, shipping, and the artist; then more of the
 * artist's merch and music, so the page leads somewhere.
 */
@Component({
  selector: 'ime-product-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    MerchGrid,
    MoneyPipe,
    MoreMenu,
    ReleaseArtistCard,
    ReleaseCardComponent,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (page.error(); as error) {
      <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
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
      <div class="mx-auto flex max-w-5xl flex-col gap-16">
        <div class="grid gap-8 md:grid-cols-2">
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
              <h1 class="text-5xl leading-[0.95] font-black tracking-[-0.05em]">
                {{ page.product.name }}
              </h1>
              <div class="flex items-center justify-between gap-3">
                <p>
                  by
                  <a
                    class="link font-medium"
                    [routerLink]="['/artists', page.artist.handle]"
                    >{{ page.artist.name }}</a
                  >
                </p>
                <ime-more-menu
                  label="More for this item"
                  [actions]="productActions()"
                />
              </div>
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
                        <option
                          [value]="count"
                          [selected]="count === quantity()"
                        >
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
                  class="link"
                  [routerLink]="['/artists', page.artist.handle, release.slug]"
                  >{{ release.title }}</a
                >, in your library as soon as you pay.
              </ime-alert>
            } @else if (page.release; as release) {
              <p class="text-sm">
                An edition of
                <a
                  class="link"
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
                    }}:
                    {{ rate.firstItemAmount | money: page.product.currency }},
                    then
                    {{
                      rate.additionalItemAmount | money: page.product.currency
                    }}
                    for each additional one
                  </p>
                }
              </section>
            }

            <ime-release-artist-card [handle]="page.artist.handle" />
          </div>
        </div>

        @if (moreMerch().length) {
          <section
            class="flex flex-col gap-4"
            aria-labelledby="more-merch-heading"
          >
            <div class="flex items-baseline justify-between gap-4">
              <h2
                id="more-merch-heading"
                class="text-2xl font-extrabold tracking-[-0.035em]"
              >
                More from {{ page.artist.name }}
              </h2>
              <a
                class="link shrink-0 text-sm"
                [routerLink]="['/artists', page.artist.handle]"
                >See all</a
              >
            </div>
            <ime-merch-grid
              [items]="moreMerch()"
              [handle]="page.artist.handle"
            />
          </section>
        }

        @if (music().length) {
          <section class="flex flex-col gap-4" aria-labelledby="music-heading">
            <div class="flex items-baseline justify-between gap-4">
              <h2
                id="music-heading"
                class="text-2xl font-extrabold tracking-[-0.035em]"
              >
                Music from {{ page.artist.name }}
              </h2>
              <a
                class="link shrink-0 text-sm"
                [routerLink]="['/artists', page.artist.handle]"
                >See all</a
              >
            </div>
            <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              @for (release of music(); track release.id) {
                <li>
                  <ime-release-card
                    [title]="release.title"
                    [link]="['/artists', page.artist.handle, release.slug]"
                    [coverUrl]="release.coverUrl"
                    [subtitle]="subtitle(release)"
                  />
                </li>
              }
            </ul>
          </section>
        }
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
  private readonly session = inject(SessionService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  public readonly handle = input.required<string>();
  public readonly productId = input.required<string>();

  protected readonly page = resource({
    id: 'product-page',
    params: () => this.productId(),
    loader: async ({ params }) =>
      unwrap(await this.api.merch.getProductPage(params)),
  });
  protected readonly product = computed(() => currentValue(this.page));

  protected readonly subtitle = discographySubtitle;

  private readonly store = resource({
    id: 'product-more-merch',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.merch.listStore(params)),
  });
  protected readonly moreMerch = computed(() =>
    (currentValue(this.store) ?? [])
      .filter((item) => item.id !== this.productId())
      .slice(0, MORE_MERCH),
  );

  private readonly discography = resource({
    id: 'product-more-music',
    params: () => this.handle(),
    loader: async ({ params }) =>
      unwrap(await this.api.catalog.listDiscography(params)),
  });
  protected readonly music = computed(() =>
    newestFirst(currentValue(this.discography) ?? []).slice(0, MORE_MUSIC),
  );

  protected readonly productActions = computed<MenuAction[]>(() => [
    { label: 'Report', run: () => this.report() },
  ]);

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

  private async report(): Promise<void> {
    const page = this.product();
    if (!page) return;
    if (this.session.status() === 'signed-out') {
      await this.router.navigate(['/sign-in'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    await openReport(this.injector, {
      targetType: 'product',
      targetId: page.product.id,
      label: page.product.name,
    });
  }
}
