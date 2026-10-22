import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import {
  type CartRelease,
  CartService,
  SessionService,
} from '@ime/client-data';
import type { ReleasePageResponse, TracklistItem } from '@ime/models';
import { AlertComponent, ButtonDirective, MoneyPipe } from '@ime/ui';

/**
 * Beside a release's cover: what it costs and how to get it, or, for an
 * owner, its downloads.
 */
@Component({
  selector: 'ime-buy-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, MoneyPipe, RouterLink],
  host: {
    class: 'flex flex-col gap-3 rounded-card border border-line bg-surface p-4',
  },
  template: `
    @if (owned()) {
      <p class="font-medium">In your library</p>
      <p class="text-sm text-ink-muted">
        Stream every track, or download the originals exactly as the artist
        uploaded them.
      </p>
      <ul class="flex flex-col divide-y divide-hairline text-sm">
        @for (track of page().tracks; track track.trackId) {
          <li class="flex items-center justify-between gap-3 py-1.5">
            <span class="truncate"
              >{{ track.position }}. {{ track.title }}</span
            >
            <button
              imeButton
              variant="ghost"
              size="sm"
              [busy]="downloading() === track.trackId"
              [attr.aria-label]="'Download ' + track.title"
              (click)="download(track)"
            >
              Download
            </button>
          </li>
        }
      </ul>
    } @else if (!page().onSale) {
      <p class="text-sm text-ink-muted">Not available to buy right now.</p>
    } @else if (page().pricing; as pricing) {
      @if (pricing.mode === 'free') {
        <p class="font-medium">Free</p>
        <p class="text-sm text-ink-muted">Add it to your library at no cost.</p>
        @if (session.isSignedIn()) {
          <button imeButton [busy]="claiming()" (click)="claim()">
            Get it free
          </button>
        } @else {
          <a
            imeButton
            routerLink="/sign-in"
            [queryParams]="{ returnUrl: router.url }"
          >
            Sign in to get it
          </a>
        }
      } @else {
        <p class="font-medium">
          @if (pricing.mode === 'fixed') {
            {{ pricing.minimumPrice | money: currency() }}
            <span class="font-normal text-ink-muted">or more</span>
          } @else {
            Name your price
          }
        </p>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-ink-muted">
            @if (pricing.minimumPrice > 0) {
              Pay {{ pricing.minimumPrice | money: currency() }} or more
            } @else {
              Pay what you like, even nothing
            }
          </span>
          <span
            class="flex items-center gap-2 rounded-control border border-line bg-canvas px-3 focus-within:ring-2 focus-within:ring-accent"
          >
            <span class="text-ink-muted">{{ symbol() }}</span>
            <input
              class="h-10 w-full bg-transparent text-ink outline-none"
              type="number"
              inputmode="decimal"
              step="0.01"
              [min]="pricing.minimumPrice / 100"
              [value]="draft()"
              [attr.aria-invalid]="amount() === null || null"
              (input)="onDraft($event)"
            />
            <span class="text-ink-muted uppercase">{{ currency() }}</span>
          </span>
        </label>
        @if (amount() === null) {
          <p class="text-sm text-danger">
            Enter at least {{ pricing.minimumPrice | money: currency() }}.
          </p>
        }
        @if (pricing.suggestedPrice; as suggested) {
          <p class="text-sm text-ink-muted">
            The artist suggests {{ suggested | money: currency() }}.
          </p>
        }
        @if (amount() === 0) {
          @if (session.isSignedIn()) {
            <button imeButton [busy]="claiming()" (click)="claim()">
              Get it free
            </button>
          } @else {
            <a
              imeButton
              routerLink="/sign-in"
              [queryParams]="{ returnUrl: router.url }"
            >
              Sign in to get it
            </a>
          }
        } @else {
          <button
            imeButton
            [disabled]="amount() === null"
            (click)="addToCart()"
          >
            {{ inCart() ? 'Update cart' : 'Add to cart' }}
          </button>
          @if (inCart()) {
            <a imeButton variant="secondary" routerLink="/cart">View cart</a>
          }
        }
      }
    }
    @if (error(); as message) {
      <ime-alert tone="error">{{ message }}</ime-alert>
    }
  `,
})
export class BuyPanel {
  private readonly api = inject(ApiClient);
  private readonly cart = inject(CartService);
  protected readonly session = inject(SessionService);
  protected readonly router = inject(Router);

  public readonly page = input.required<ReleasePageResponse>();
  public readonly owned = input(false);
  /** The release is now in the viewer's library. */
  public readonly claimed = output<void>();

  protected readonly claiming = signal(false);
  protected readonly downloading = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly currency = computed(
    () => this.page().pricing?.currency ?? 'usd',
  );
  protected readonly symbol = computed(() =>
    this.currency() === 'eur' ? '€' : '$',
  );

  /** What the buyer typed, starting from the price in the cart or suggested. */
  protected readonly draft = linkedSignal(() => {
    const pricing = this.page().pricing;
    const inCart = this.cart
      .items()
      .find(
        (item): item is CartRelease =>
          item.kind === 'release' && item.releaseId === this.page().release.id,
      );
    const amount =
      inCart?.amount ?? pricing?.suggestedPrice ?? pricing?.minimumPrice ?? 0;
    return (amount / 100).toFixed(2);
  });

  /** The amount in minor units, or null when it is not a valid price. */
  protected readonly amount = computed(() => {
    const value = Number(this.draft());
    const minimum = this.page().pricing?.minimumPrice ?? 0;
    if (this.draft().trim() === '' || !Number.isFinite(value)) return null;
    const minor = Math.round(value * 100);
    return minor >= minimum ? minor : null;
  });

  protected readonly inCart = computed(() =>
    this.cart
      .items()
      .some(
        (item) =>
          item.kind === 'release' && item.releaseId === this.page().release.id,
      ),
  );

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected addToCart(): void {
    const page = this.page();
    const amount = this.amount();
    if (amount === null || !page.pricing) return;
    this.cart.add({
      kind: 'release',
      releaseId: page.release.id,
      artistId: page.artist.id,
      artistName: page.artist.name,
      artistHandle: page.artist.handle,
      title: page.release.title,
      slug: page.release.slug,
      coverUrl: page.coverUrl,
      currency: this.currency(),
      amount,
      minimumPrice: page.pricing.minimumPrice,
    });
  }

  protected async claim(): Promise<void> {
    this.claiming.set(true);
    this.error.set(null);
    const result = await this.cart.claim(
      this.page().release.id,
      this.page().pricing?.mode === 'name_your_price',
    );
    this.claiming.set(false);
    if (result.ok) {
      this.claimed.emit();
    } else {
      this.error.set(result.error.message);
    }
  }

  protected async download(track: TracklistItem): Promise<void> {
    this.downloading.set(track.trackId);
    this.error.set(null);
    const result = await this.api.catalog.getDownloadUrl(
      this.page().release.id,
      track.trackId,
    );
    this.downloading.set(null);
    if (result.ok) {
      window.location.assign(result.data.url);
    } else {
      this.error.set(result.error.message);
    }
  }
}
