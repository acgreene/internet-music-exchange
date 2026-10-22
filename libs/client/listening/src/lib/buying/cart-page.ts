import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import {
  type CartEntry,
  cartKey,
  type CartMerch,
  type CartRelease,
  CartService,
  SessionService,
} from '@ime/client-data';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  FieldComponent,
  InputDirective,
  MoneyPipe,
} from '@ime/ui';
import { COUNTRIES } from './countries';

interface ArtistGroup {
  artistId: string;
  artistName: string;
  artistHandle: string;
  currency: string;
  items: CartEntry[];
  subtotal: number;
}

const lineTotal = (entry: CartEntry) =>
  entry.kind === 'merch' ? entry.unitPrice * entry.quantity : entry.amount;

/**
 * The cart, grouped by artist, since each artist is paid on their own, with
 * where to ship anything physical.
 */
@Component({
  selector: 'ime-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    FieldComponent,
    FormField,
    InputDirective,
    MoneyPipe,
    RouterLink,
  ],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Cart</h1>

      @for (group of groups(); track group.artistId) {
        <section
          class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
        >
          <h2 class="flex items-baseline justify-between gap-4">
            <a
              class="link font-semibold"
              [routerLink]="['/artists', group.artistHandle]"
              >{{ group.artistName }}</a
            >
            <span class="text-sm text-ink-muted">{{
              group.subtotal | money: group.currency
            }}</span>
          </h2>
          <ul class="flex flex-col divide-y divide-hairline">
            @for (item of group.items; track key(item)) {
              <li class="flex flex-wrap items-center gap-4 py-3">
                @if (item.kind === 'release') {
                  <ime-cover
                    class="w-16 shrink-0"
                    [src]="item.coverUrl"
                    [alt]="'Cover of ' + item.title"
                  />
                  <div class="flex min-w-0 flex-1 flex-col">
                    <a
                      class="truncate font-medium hover:underline"
                      [routerLink]="['/artists', item.artistHandle, item.slug]"
                      >{{ item.title }}</a
                    >
                    <span class="text-sm text-ink-muted">Digital release</span>
                  </div>
                  <label class="flex items-center gap-1 text-sm">
                    <span class="sr-only"
                      >What you pay for {{ item.title }}</span
                    >
                    <span class="text-ink-muted">{{
                      item.currency === 'eur' ? '€' : '$'
                    }}</span>
                    <input
                      class="h-9 w-24 rounded-control border border-line bg-canvas px-2 text-right"
                      type="number"
                      inputmode="decimal"
                      step="0.01"
                      [min]="item.minimumPrice / 100"
                      [value]="(item.amount / 100).toFixed(2)"
                      [attr.aria-invalid]="
                        invalid().has(item.releaseId) || null
                      "
                      (change)="setAmount(item, $event)"
                    />
                  </label>
                } @else {
                  <ime-cover
                    class="w-16 shrink-0"
                    [src]="item.imageUrl"
                    [alt]="item.name"
                  />
                  <div class="flex min-w-0 flex-1 flex-col">
                    <a
                      class="truncate font-medium hover:underline"
                      [routerLink]="[
                        '/artists',
                        item.artistHandle,
                        'merch',
                        item.productId,
                      ]"
                      >{{ item.name }}</a
                    >
                    <span class="text-sm text-ink-muted">
                      {{ item.variantLabel ?? 'Merch' }} ·
                      {{ item.unitPrice | money: item.currency }} each
                    </span>
                  </div>
                  <label class="flex items-center gap-1 text-sm">
                    <span class="sr-only">How many of {{ item.name }}</span>
                    <span class="text-ink-muted">Qty</span>
                    <select
                      class="h-9 rounded-control border border-line bg-canvas px-2"
                      (change)="setQuantity(item, $event)"
                    >
                      @for (count of quantities(item); track count) {
                        <option
                          [value]="count"
                          [selected]="count === item.quantity"
                        >
                          {{ count }}
                        </option>
                      }
                    </select>
                  </label>
                }
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  [attr.aria-label]="'Remove ' + label(item)"
                  (click)="cart.remove(key(item))"
                >
                  Remove
                </button>
              </li>
              @if (item.kind === 'release' && invalid().has(item.releaseId)) {
                <li class="pb-2 text-sm text-danger">
                  Pay at least {{ item.minimumPrice | money: item.currency }}.
                </li>
              }
            }
          </ul>
        </section>
      } @empty {
        <p class="text-ink-muted">
          Your cart is empty.
          <a class="link" routerLink="/">Find something to listen to.</a>
        </p>
      }

      @if (cart.needsShipping()) {
        <section class="flex flex-col gap-3" aria-labelledby="shipping-heading">
          <div>
            <h2 id="shipping-heading" class="text-lg font-semibold">
              Shipping to
            </h2>
            <p class="text-sm text-ink-muted">
              Each artist ships their own items, at their own rates, added at
              checkout.
            </p>
          </div>
          <div
            class="grid gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-2"
          >
            <ime-field
              class="sm:col-span-2"
              label="Name"
              [errors]="addressForm.name().errors()"
              [touched]="addressForm.name().touched()"
            >
              <input
                imeInput
                autocomplete="shipping name"
                [formField]="addressForm.name"
              />
            </ime-field>
            <ime-field
              class="sm:col-span-2"
              label="Address"
              [errors]="addressForm.line1().errors()"
              [touched]="addressForm.line1().touched()"
            >
              <input
                imeInput
                autocomplete="shipping address-line1"
                [formField]="addressForm.line1"
              />
            </ime-field>
            <ime-field
              class="sm:col-span-2"
              label="Apartment, suite, etc."
              hint="Optional."
            >
              <input
                imeInput
                autocomplete="shipping address-line2"
                [formField]="addressForm.line2"
              />
            </ime-field>
            <ime-field
              label="City"
              [errors]="addressForm.city().errors()"
              [touched]="addressForm.city().touched()"
            >
              <input
                imeInput
                autocomplete="shipping address-level2"
                [formField]="addressForm.city"
              />
            </ime-field>
            <ime-field label="State or region" hint="If your address has one.">
              <input
                imeInput
                autocomplete="shipping address-level1"
                [formField]="addressForm.state"
              />
            </ime-field>
            <ime-field
              label="Postal code"
              [errors]="addressForm.postalCode().errors()"
              [touched]="addressForm.postalCode().touched()"
            >
              <input
                imeInput
                autocomplete="shipping postal-code"
                [formField]="addressForm.postalCode"
              />
            </ime-field>
            <ime-field label="Country">
              <select
                imeInput
                autocomplete="shipping country"
                [formField]="addressForm.country"
              >
                @for (country of countries; track country.code) {
                  <option [value]="country.code">{{ country.name }}</option>
                }
              </select>
            </ime-field>
          </div>
        </section>
      }

      @if (groups().length) {
        <div class="flex flex-col gap-3">
          @if (groups().length > 1) {
            <p class="text-sm text-ink-muted">
              Each artist is paid directly, so you will make
              {{ groups().length }} payments, one after another.
            </p>
          }
          @if (error(); as message) {
            <ime-alert tone="error">{{ message }}</ime-alert>
          }
          <div>
            @switch (session.status()) {
              @case ('signed-in') {
                <button
                  imeButton
                  [busy]="addressForm().submitting() || checkingOut()"
                  [disabled]="invalid().size > 0"
                  (click)="checkout()"
                >
                  Check out
                </button>
              }
              @case ('signed-out') {
                <a
                  imeButton
                  routerLink="/sign-in"
                  [queryParams]="{ returnUrl: '/cart' }"
                  >Sign in to check out</a
                >
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CartPage {
  protected readonly cart = inject(CartService);
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly countries = COUNTRIES;
  protected readonly checkingOut = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Releases whose typed amount is under their minimum. */
  protected readonly invalid = signal(new Set<string>());

  private readonly address = signal({
    name: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  });
  protected readonly addressForm = form(this.address, (path) => {
    required(path.name, { message: 'Who is it for?' });
    required(path.line1, { message: 'Enter the street address.' });
    required(path.city, { message: 'Enter the city.' });
    required(path.postalCode, { message: 'Enter the postal code.' });
  });

  protected readonly groups = computed<ArtistGroup[]>(() => {
    const groups = new Map<string, ArtistGroup>();
    for (const item of this.cart.items()) {
      const group = groups.get(item.artistId) ?? {
        artistId: item.artistId,
        artistName: item.artistName,
        artistHandle: item.artistHandle,
        currency: item.currency,
        items: [],
        subtotal: 0,
      };
      group.items.push(item);
      group.subtotal += lineTotal(item);
      groups.set(item.artistId, group);
    }
    return [...groups.values()];
  });

  protected readonly key = cartKey;

  protected label(item: CartEntry): string {
    return item.kind === 'merch' ? item.name : item.title;
  }

  /** The quantities a buyer can choose, up to the stock when added. */
  protected quantities(item: CartMerch): number[] {
    return Array.from(
      { length: Math.max(Math.min(item.stock, 10), item.quantity) },
      (_, index) => index + 1,
    );
  }

  protected setQuantity(item: CartMerch, event: Event): void {
    this.cart.setQuantity(
      item.variantId,
      Number((event.target as HTMLSelectElement).value),
    );
  }

  protected setAmount(item: CartRelease, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    const amount = Math.round(value * 100);
    const invalid = new Set(this.invalid());
    if (!Number.isFinite(value) || amount < item.minimumPrice) {
      invalid.add(item.releaseId);
    } else {
      invalid.delete(item.releaseId);
      this.cart.setAmount(item.releaseId, amount);
    }
    this.invalid.set(invalid);
  }

  protected async checkout(): Promise<void> {
    this.error.set(null);
    if (!this.cart.needsShipping()) {
      await this.send();
      return;
    }
    await submit(this.addressForm, async () => {
      await this.send();
      return undefined;
    });
  }

  private async send(): Promise<void> {
    const { line2, state, ...address } = this.address();
    this.checkingOut.set(true);
    const result = await this.cart.checkout({
      ...address,
      line2: line2.trim() || null,
      state: state.trim() || null,
    });
    this.checkingOut.set(false);
    if (!result.ok) {
      this.error.set(result.error.message);
      return;
    }
    await this.router.navigate(['/checkout', result.data.orderId]);
  }
}
