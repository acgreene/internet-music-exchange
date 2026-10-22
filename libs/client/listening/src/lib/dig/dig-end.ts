import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import { CartService, SessionService } from '@ime/client-data';
import type { DigRecord } from '@ime/models';
import { AlertComponent, CoverComponent } from '@ime/ui';
import { formatMoney } from '@ime/utils';
import { releasePriceLabel } from '../releases/release-labels';

/** `digital`, or the id of an edition's variant. */
type Format = string;

/**
 * The bottom of the crate: how many records were dug and kept and how long
 * the listener listened, and the bag, which they can buy (picking a format
 * for each record), save as a crate, or leave.
 */
@Component({
  selector: 'ime-dig-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, CoverComponent, RouterLink],
  template: `
    <section
      class="mx-auto flex w-full max-w-3xl flex-col gap-8"
      aria-labelledby="end-heading"
    >
      <div class="flex flex-col gap-3">
        <span class="font-mono text-xs tracking-wider text-canvas/60 uppercase"
          >The bottom of the crate</span
        >
        <h2
          id="end-heading"
          class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-6xl"
        >
          You dug {{ dug() }} {{ dug() === 1 ? 'record' : 'records' }}.
        </h2>
        <dl class="flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm">
          <div class="flex gap-2">
            <dt class="text-canvas/60">Kept</dt>
            <dd>{{ bag().length }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="text-canvas/60">Listened</dt>
            <dd>{{ listened() }}</dd>
          </div>
        </dl>
      </div>

      @if (bag().length) {
        <ul
          class="flex flex-col divide-y divide-canvas/10 border-y border-canvas/15"
        >
          @for (record of bag(); track record.release.id) {
            <li
              class="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-4 py-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_14rem]"
            >
              <ime-cover
                class="w-full"
                [src]="record.release.coverUrl"
                alt=""
              />
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-bold">{{
                  record.release.title
                }}</span>
                <span class="truncate text-sm text-canvas/70">{{
                  record.release.artistName
                }}</span>
              </span>
              @if (record.owned) {
                <span
                  class="col-span-2 font-mono text-xs text-canvas/70 sm:col-span-1"
                  >Already yours</span
                >
              } @else {
                <select
                  class="col-span-2 rounded-control border border-canvas/30 bg-ink px-2 py-1.5 text-sm sm:col-span-1"
                  [attr.aria-label]="'Format for ' + record.release.title"
                  (change)="
                    choose(record.release.id, $any($event.target).value)
                  "
                >
                  <option
                    value="digital"
                    [selected]="formatOf(record) === 'digital'"
                  >
                    Digital · {{ price(record) }}
                  </option>
                  @for (edition of record.editions; track edition.variantId) {
                    <option
                      [value]="edition.variantId"
                      [selected]="formatOf(record) === edition.variantId"
                    >
                      {{ formatName(edition.format) }}
                      {{
                        edition.variantLabel
                          ? '(' + edition.variantLabel + ')'
                          : ''
                      }}
                      · {{ money(edition.price, edition.currency) }}
                    </option>
                  }
                </select>
              }
            </li>
          }
        </ul>
        @if (error(); as error) {
          <ime-alert tone="error">{{ error }}</ime-alert>
        }
        <div class="flex flex-wrap items-center gap-3">
          @if (buyable()) {
            <button
              class="rounded-control bg-marker px-4 py-2.5 font-bold text-ink hover:bg-canvas"
              (click)="buy()"
            >
              Put the bag in my cart
            </button>
          }
          @if (session.isSignedIn()) {
            <button
              class="rounded-control border border-canvas/60 px-4 py-2.5 font-bold hover:bg-canvas hover:text-ink"
              [disabled]="saving()"
              (click)="save()"
            >
              Save the bag as a crate
            </button>
          }
          <a
            class="text-sm underline underline-offset-2"
            [routerLink]="leaveLink()"
            >Leave it</a
          >
        </div>
        <p class="text-xs text-canvas/60">
          Prices start at what each artist asks. You can change what you pay in
          the cart.
        </p>
      } @else {
        <p class="text-canvas/80">
          Nothing in the bag this time. Every dig ends; there's always another
          crate.
        </p>
        <div>
          <a
            class="rounded-control border border-canvas/60 px-4 py-2.5 font-bold hover:bg-canvas hover:text-ink"
            [routerLink]="leaveLink()"
            >Back to crates</a
          >
        </div>
      }
    </section>
  `,
})
export class DigEnd {
  private readonly api = inject(ApiClient);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  public readonly bag = input.required<DigRecord[]>();
  public readonly dug = input.required<number>();
  public readonly listenedMs = input.required<number>();
  public readonly crateName = input.required<string>();
  /** Where leaving goes: the crate dug, or all crates. */
  public readonly leaveLink = input<string[]>(['/crates']);

  /** The format chosen for each record, digital unless changed. */
  private readonly formats = linkedSignal<DigRecord[], Map<string, Format>>({
    source: () => this.bag(),
    computation: (bag, previous) =>
      new Map(
        bag.map((record) => [
          record.release.id,
          previous?.value.get(record.release.id) ?? 'digital',
        ]),
      ),
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Something in the bag the listener does not own yet. */
  protected readonly buyable = computed(() =>
    this.bag().some((record) => !record.owned),
  );

  protected readonly listened = computed(() => {
    const seconds = Math.round(this.listenedMs() / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes >= 60
      ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
      : `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`;
  });

  protected formatOf(record: DigRecord): Format {
    return this.formats().get(record.release.id) ?? 'digital';
  }

  protected choose(releaseId: string, format: Format): void {
    this.formats.update((formats) => new Map(formats).set(releaseId, format));
  }

  protected price(record: DigRecord): string {
    return releasePriceLabel(record.pricing);
  }

  protected money(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  protected formatName(format: string): string {
    return format === 'cd'
      ? 'CD'
      : format.charAt(0).toUpperCase() + format.slice(1);
  }

  /** Add every kept record to the cart in its chosen format. */
  protected async buy(): Promise<void> {
    for (const record of this.bag()) {
      if (record.owned) continue;
      const { release, pricing } = record;
      const seller = {
        artistId: release.artistId,
        artistName: release.artistName,
        artistHandle: release.artistHandle,
      };
      const edition = record.editions.find(
        (e) => e.variantId === this.formatOf(record),
      );
      if (edition) {
        this.cart.add({
          kind: 'merch',
          ...seller,
          currency: edition.currency,
          variantId: edition.variantId,
          productId: edition.productId,
          name: edition.productName,
          variantLabel: edition.variantLabel,
          imageUrl: release.coverUrl,
          unitPrice: edition.price,
          quantity: 1,
          stock: edition.stock,
        });
      } else {
        const minimum =
          pricing?.mode === 'free' ? 0 : (pricing?.minimumPrice ?? 0);
        this.cart.add({
          kind: 'release',
          ...seller,
          currency: pricing?.currency ?? 'usd',
          releaseId: release.id,
          title: release.title,
          slug: release.slug,
          coverUrl: release.coverUrl,
          amount:
            pricing?.mode === 'name_your_price'
              ? Math.max(minimum, pricing.suggestedPrice ?? minimum)
              : minimum,
          minimumPrice: minimum,
        });
      }
    }
    await this.router.navigateByUrl('/cart');
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    const result = await this.api.crates.create({
      name: `Dug from ${this.crateName()}`.slice(0, 80),
      visibility: 'private',
      releaseIds: this.bag().map((record) => record.release.id),
    });
    this.saving.set(false);
    if (result.ok) await this.router.navigate(['/crates', result.data.id]);
    else this.error.set(result.error.message);
  }
}
