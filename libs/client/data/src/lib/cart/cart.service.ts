import {
  afterNextRender,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { ApiClient, type ApiResult } from '@ime/api-client';
import type {
  CartItem as CheckoutItem,
  Currency,
  ShippingAddress,
  StartedCheckout,
} from '@ime/models';

/**
 * Who sells a cart item, since each artist is paid on their own.
 */
interface CartSeller {
  artistId: string;
  artistName: string;
  artistHandle: string;
  currency: Currency;
}

/**
 * A release in the cart, with what the cart page shows beside it.
 */
export interface CartRelease extends CartSeller {
  kind: 'release';
  releaseId: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  /** What the buyer chose to pay, in minor units. */
  amount: number;
  /** The least they may pay. */
  minimumPrice: number;
}

/**
 * Units of one merch variant in the cart.
 */
export interface CartMerch extends CartSeller {
  kind: 'merch';
  variantId: string;
  productId: string;
  name: string;
  /** The variant's options, such as `L / Black`, when it has any. */
  variantLabel: string | null;
  imageUrl: string | null;
  /** The variant's price when added; checkout charges the current one. */
  unitPrice: number;
  quantity: number;
  /** The stock when added, so the cart does not offer more. */
  stock: number;
}

export type CartEntry = CartRelease | CartMerch;

/** What identifies an entry: its release or its variant. */
export const cartKey = (entry: CartEntry): string =>
  entry.kind === 'merch' ? entry.variantId : entry.releaseId;

/**
 * A checkout whose payments the buyer is making one artist at a time.
 */
export interface PendingCheckout {
  orderId: string;
  /** Free releases already added to the library. */
  claimedCount: number;
  payments: StartedCheckout['payments'];
  paidArtistIds: string[];
}

const CART_KEY = 'ime.cart';
const CHECKOUTS_KEY = 'ime.checkouts';
/** Old checkouts kept, enough for a buyer to come back to a few. */
const KEPT_CHECKOUTS = 5;

/**
 * The cart, kept in this browser across visits and tabs. Checking out sends
 * it to the API, which prices it for real.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiClient);
  private readonly entries = signal<CartEntry[]>([]);

  public readonly items = this.entries.asReadonly();
  public readonly count = computed(() =>
    this.entries().reduce(
      (count, entry) => count + (entry.kind === 'merch' ? entry.quantity : 1),
      0,
    ),
  );
  /** Something in the cart has to be shipped. */
  public readonly needsShipping = computed(() =>
    this.entries().some((entry) => entry.kind === 'merch'),
  );

  constructor() {
    // read after the first render, so a server-rendered page hydrates as drawn
    afterNextRender(() => {
      this.entries.set(stored());
      window.addEventListener('storage', (event) => {
        if (event.key === CART_KEY) this.entries.set(stored());
      });
    });
  }

  /**
   * Add a release, replacing what the buyer chose to pay for it, or add
   * units of a variant to any already in the cart.
   */
  public add(item: CartEntry): void {
    const key = cartKey(item);
    const existing = this.entries().find((entry) => cartKey(entry) === key);
    const added =
      item.kind === 'merch' && existing?.kind === 'merch'
        ? {
            ...item,
            quantity: Math.min(existing.quantity + item.quantity, item.stock),
          }
        : item;
    this.save([
      ...this.entries().filter((entry) => cartKey(entry) !== key),
      added,
    ]);
  }

  public setAmount(releaseId: string, amount: number): void {
    this.save(
      this.entries().map((item) =>
        item.kind === 'release' && item.releaseId === releaseId
          ? { ...item, amount }
          : item,
      ),
    );
  }

  public setQuantity(variantId: string, quantity: number): void {
    this.save(
      this.entries().map((item) =>
        item.kind === 'merch' && item.variantId === variantId
          ? { ...item, quantity }
          : item,
      ),
    );
  }

  /**
   * Take out a release or a variant, by its id.
   */
  public remove(key: string): void {
    this.save(this.entries().filter((item) => cartKey(item) !== key));
  }

  /**
   * Check out the whole cart. Free items are owned at once; each artist with
   * something to pay for gets a payment. The checkout is remembered here so
   * its page can walk the buyer through the payments.
   */
  public async checkout(
    shippingAddress?: ShippingAddress,
  ): Promise<ApiResult<StartedCheckout>> {
    const result = await this.api.orders.checkout({
      items: this.entries().map((item): CheckoutItem =>
        item.kind === 'merch'
          ? { variantId: item.variantId, quantity: item.quantity }
          : { releaseId: item.releaseId, amount: item.amount },
      ),
      shippingAddress: this.needsShipping() ? shippingAddress : undefined,
    });
    if (result.ok) {
      this.save([]);
      this.remember(result.data);
    }
    return result;
  }

  /**
   * Take a free release, or a name-your-price one at nothing, straight into
   * the library without the cart. The amount is sent as nothing, since the
   * API otherwise charges the suggested price.
   */
  public async claim(
    releaseId: string,
    namedPrice: boolean,
  ): Promise<ApiResult<StartedCheckout>> {
    const result = await this.api.orders.checkout({
      items: [namedPrice ? { releaseId, amount: 0 } : { releaseId }],
    });
    if (result.ok) this.remove(releaseId);
    return result;
  }

  public pendingCheckout(orderId: string): PendingCheckout | null {
    return (
      (read<PendingCheckout[]>(CHECKOUTS_KEY) ?? []).find(
        (checkout) => checkout.orderId === orderId,
      ) ?? null
    );
  }

  /**
   * Note that one artist's payment went through, as Stripe reported on
   * sending the buyer back.
   */
  public markPaid(orderId: string, artistId: string): void {
    const checkouts = read<PendingCheckout[]>(CHECKOUTS_KEY) ?? [];
    const updated = checkouts.map((checkout) =>
      checkout.orderId === orderId && !checkout.paidArtistIds.includes(artistId)
        ? { ...checkout, paidArtistIds: [...checkout.paidArtistIds, artistId] }
        : checkout,
    );
    write(CHECKOUTS_KEY, updated);
  }

  private remember(started: StartedCheckout): void {
    const checkouts = read<PendingCheckout[]>(CHECKOUTS_KEY) ?? [];
    write(
      CHECKOUTS_KEY,
      [
        {
          orderId: started.orderId,
          claimedCount: started.claimedReleaseIds.length,
          payments: started.payments,
          paidArtistIds: [],
        },
        ...checkouts,
      ].slice(0, KEPT_CHECKOUTS),
    );
  }

  private save(items: CartEntry[]): void {
    this.entries.set(items);
    write(CART_KEY, items);
  }
}

/**
 * The stored cart. Entries saved before merch could be added are releases.
 */
function stored(): CartEntry[] {
  return (read<CartEntry[]>(CART_KEY) ?? []).map((entry) =>
    entry.kind ? entry : { ...(entry as CartRelease), kind: 'release' },
  );
}

function read<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private browsing or full storage: the cart lasts for this visit only
  }
}
