import {
  afterNextRender,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { ApiClient, type ApiResult } from '@ime/api-client';
import type { Currency, StartedCheckout } from '@ime/models';

/**
 * A release in the cart, with what the cart page shows beside it.
 */
export interface CartRelease {
  releaseId: string;
  artistId: string;
  artistName: string;
  artistHandle: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  currency: Currency;
  /** What the buyer chose to pay, in minor units. */
  amount: number;
  /** The least they may pay. */
  minimumPrice: number;
}

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
  private readonly entries = signal<CartRelease[]>([]);

  public readonly items = this.entries.asReadonly();
  public readonly count = computed(() => this.entries().length);

  constructor() {
    // read after the first render, so a server-rendered page hydrates as drawn
    afterNextRender(() => {
      this.entries.set(read<CartRelease[]>(CART_KEY) ?? []);
      window.addEventListener('storage', (event) => {
        if (event.key === CART_KEY) {
          this.entries.set(read<CartRelease[]>(CART_KEY) ?? []);
        }
      });
    });
  }

  public has(releaseId: string): boolean {
    return this.entries().some((item) => item.releaseId === releaseId);
  }

  /**
   * Add a release, or update what the buyer chose to pay for it.
   */
  public add(item: CartRelease): void {
    this.save([
      ...this.entries().filter((entry) => entry.releaseId !== item.releaseId),
      item,
    ]);
  }

  public setAmount(releaseId: string, amount: number): void {
    this.save(
      this.entries().map((item) =>
        item.releaseId === releaseId ? { ...item, amount } : item,
      ),
    );
  }

  public remove(releaseId: string): void {
    this.save(this.entries().filter((item) => item.releaseId !== releaseId));
  }

  /**
   * Check out the whole cart. Free items are owned at once; each artist with
   * something to pay for gets a payment. The checkout is remembered here so
   * its page can walk the buyer through the payments.
   */
  public async checkout(): Promise<ApiResult<StartedCheckout>> {
    const result = await this.api.orders.checkout({
      items: this.entries().map(({ releaseId, amount }) => ({
        releaseId,
        amount,
      })),
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

  private save(items: CartRelease[]): void {
    this.entries.set(items);
    write(CART_KEY, items);
  }
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
