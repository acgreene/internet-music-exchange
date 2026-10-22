import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  type CartRelease,
  CartService,
  SessionService,
} from '@ime/client-data';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  MoneyPipe,
} from '@ime/ui';

interface ArtistGroup {
  artistId: string;
  artistName: string;
  artistHandle: string;
  currency: string;
  items: CartRelease[];
  subtotal: number;
}

/**
 * The cart, grouped by artist, since each artist is paid on their own.
 */
@Component({
  selector: 'ime-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    MoneyPipe,
    RouterLink,
  ],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 class="text-2xl font-semibold tracking-tight">Cart</h1>

      @for (group of groups(); track group.artistId) {
        <section
          class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
        >
          <h2 class="flex items-baseline justify-between gap-4">
            <a
              class="font-semibold hover:underline"
              [routerLink]="['/artists', group.artistHandle]"
              >{{ group.artistName }}</a
            >
            <span class="text-sm text-ink-muted">{{
              group.subtotal | money: group.currency
            }}</span>
          </h2>
          <ul class="flex flex-col divide-y divide-line">
            @for (item of group.items; track item.releaseId) {
              <li class="flex items-center gap-4 py-3">
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
                  <span class="sr-only">What you pay for {{ item.title }}</span>
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
                    [attr.aria-invalid]="invalid().has(item.releaseId) || null"
                    (change)="setAmount(item, $event)"
                  />
                </label>
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  [attr.aria-label]="'Remove ' + item.title"
                  (click)="cart.remove(item.releaseId)"
                >
                  Remove
                </button>
              </li>
              @if (invalid().has(item.releaseId)) {
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
          <a class="underline" routerLink="/">Find something to listen to.</a>
        </p>
      }

      @if (groups().length) {
        <div class="flex flex-col gap-3">
          @if (groups().length > 1) {
            <p class="text-sm text-ink-muted">
              Each artist is paid directly, so you will make
              {{ groups().length }}
              payments, one after another.
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
                  [busy]="checkingOut()"
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
                >
                  Sign in to check out
                </a>
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

  protected readonly checkingOut = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Releases whose typed amount is under their minimum. */
  protected readonly invalid = signal(new Set<string>());

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
      group.subtotal += item.amount;
      groups.set(item.artistId, group);
    }
    return [...groups.values()];
  });

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
    this.checkingOut.set(true);
    this.error.set(null);
    const result = await this.cart.checkout();
    this.checkingOut.set(false);
    if (!result.ok) {
      this.error.set(result.error.message);
      return;
    }
    await this.router.navigate(['/checkout', result.data.orderId]);
  }
}
