import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { ArtistPageHost } from '@ime/client-artist-pages';
import { SessionService, currentValue } from '@ime/client-data';
import {
  ApiError,
  type ArtistPagePlayback,
  HttpStatus,
  type Shelf,
} from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { ShelfRow } from '../home/shelf-row';
import { PageMetaService } from '../page-meta';
import { releasePriceLabel } from '../releases/release-labels';
import { PlaceholderMusic } from './placeholder-music';
import {
  PLACEHOLDER_KINDS,
  type PlaceholderKind,
  placeholderRelease,
  readCover,
} from './placeholder-release';

type Device = 'desktop' | 'phone';

const SEGMENT =
  'rounded-control px-3 py-1.5 text-sm font-medium aria-pressed:bg-ink aria-pressed:text-canvas hover:bg-wash aria-pressed:hover:bg-ink';

/**
 * A design in the gallery, `/designs/<id>`: try it with a stand-in album, an
 * EP, or a single, on a desktop or a phone, with your own cover if you like;
 * hear it on real releases; use it on your music, or ask its designer for
 * one of your own.
 */
@Component({
  selector: 'ime-design-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ArtistPageHost,
    ButtonDirective,
    InputDirective,
    RouterLink,
    ShelfRow,
    SpinnerComponent,
  ],
  template: `
    @if (page(); as page) {
      <div class="mx-auto flex max-w-6xl flex-col gap-8">
        <a class="link w-fit text-sm" routerLink="/designs">All designs</a>

        <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section class="flex min-w-0 flex-col gap-3" aria-label="Preview">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div
                class="hidden gap-1 md:flex"
                role="group"
                aria-label="Device"
              >
                @for (option of devices; track option.id) {
                  <button
                    type="button"
                    [class]="segment"
                    [attr.aria-pressed]="device() === option.id"
                    (click)="device.set(option.id)"
                  >
                    {{ option.name }}
                  </button>
                }
              </div>
              <div class="flex gap-1" role="group" aria-label="Release">
                @for (option of kinds; track option.id) {
                  <button
                    type="button"
                    [class]="segment"
                    [attr.aria-pressed]="kind() === option.id"
                    (click)="kind.set(option.id)"
                  >
                    {{ option.name }}
                  </button>
                }
              </div>
              <label imeButton variant="ghost" size="sm" class="cursor-pointer">
                {{ cover() ? 'Try another cover' : 'Try your cover' }}
                <input
                  class="sr-only"
                  type="file"
                  accept="image/*"
                  (change)="pickCover($event)"
                />
              </label>
              @if (cover()) {
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  (click)="cover.set(null)"
                >
                  Use the stand-in
                </button>
              }
            </div>

            <div
              class="overflow-hidden border border-line bg-surface"
              [class]="
                device() === 'phone'
                  ? 'mx-auto h-[min(780px,80vh)] w-[390px] max-w-full rounded-[2rem] border-8 !border-ink'
                  : 'aspect-[16/10] w-full'
              "
            >
              @for (key of [previewKey()]; track key) {
                <ime-artist-page-host
                  fill
                  [bundleUrl]="page.bundleUrl"
                  [payload]="payload()"
                  [playback]="playback()"
                  (playRequested)="play($event)"
                  (pauseRequested)="stop()"
                  (purchaseRequested)="buy()"
                />
              }
            </div>
            @if (note(); as note) {
              <p class="text-sm text-ink-muted" aria-live="polite">
                {{ note }}
              </p>
            }
          </section>

          <aside class="flex flex-col gap-6">
            <div class="flex flex-col gap-2">
              <h1 class="text-4xl leading-[0.95] font-black tracking-[-0.05em]">
                {{ page.design.name }}
              </h1>
              @if (page.designer?.username; as username) {
                <p class="text-sm text-ink-muted">by &#64;{{ username }}</p>
              }
              @if (page.design.description; as description) {
                <p class="leading-relaxed">{{ description }}</p>
              }
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt class="text-ink-muted">Price</dt>
                <dd>{{ price() }}</dd>
                <dt class="text-ink-muted">Used on</dt>
                <dd>
                  {{ page.releaseCount }}
                  {{ page.releaseCount === 1 ? 'release' : 'releases' }}
                </dd>
                @if (page.slots.length) {
                  <dt class="text-ink-muted">Artists add</dt>
                  <dd>{{ slotLabels() }}</dd>
                }
              </dl>
            </div>

            <div class="flex flex-col gap-2">
              <a imeButton [routerLink]="useLink()" [queryParams]="useQuery()"
                >Use it on your music</a
              >
            </div>

            @if (page.designer?.openToCommissions) {
              <section
                class="flex flex-col gap-3 border-t border-line pt-6"
                aria-labelledby="commission-heading"
              >
                <h2 id="commission-heading" class="font-bold">
                  Want one made for your record?
                </h2>
                <p class="text-sm">
                  &#64;{{ page.designer.username }} takes requests for custom
                  designs. You arrange the work and the price between you; it
                  arrives as a design only your artist can use.
                </p>
                @if (sent()) {
                  <ime-alert tone="success"
                    >Sent. They'll reply to your email.</ime-alert
                  >
                } @else if (session.isSignedIn()) {
                  <textarea
                    imeInput
                    rows="4"
                    aria-label="Your request"
                    placeholder="Tell them about your record and what you have in mind."
                    [value]="message()"
                    (input)="message.set($any($event.target).value)"
                  ></textarea>
                  <p class="text-xs text-ink-muted">
                    They get your message and your email address, so they can
                    reply.
                  </p>
                  @if (error(); as error) {
                    <ime-alert tone="error">{{ error }}</ime-alert>
                  }
                  <div>
                    <button
                      imeButton
                      variant="secondary"
                      [busy]="sending()"
                      [disabled]="!message().trim()"
                      (click)="ask()"
                    >
                      Send request
                    </button>
                  </div>
                } @else {
                  <a
                    class="link text-sm"
                    routerLink="/sign-in"
                    [queryParams]="{ returnUrl: '/designs/' + page.design.id }"
                    >Sign in to ask</a
                  >
                }
              </section>
            }
          </aside>
        </div>

        @if (releasesShelf(); as shelf) {
          <ime-shelf-row [shelf]="shelf" />
        }
      </div>
    } @else if (design.error()) {
      <ime-alert tone="error">{{
        notFound()
          ? 'That design is not in the gallery.'
          : 'The design could not be loaded.'
      }}</ime-alert>
    } @else {
      <ime-spinner />
    }
  `,
})
export class DesignPage {
  private readonly api = inject(ApiClient);
  private readonly meta = inject(PageMetaService);
  protected readonly session = inject(SessionService);

  /** The `designId` route parameter. */
  public readonly designId = input.required<string>();

  protected readonly segment = SEGMENT;
  protected readonly kinds = PLACEHOLDER_KINDS;
  protected readonly devices: { id: Device; name: string }[] = [
    { id: 'desktop', name: 'Desktop' },
    { id: 'phone', name: 'Phone' },
  ];

  protected readonly design = resource({
    id: 'gallery-design',
    params: () => this.designId(),
    loader: async ({ params }) =>
      unwrap(await this.api.designs.getGalleryDesign(params)),
  });
  protected readonly page = computed(() => currentValue(this.design));
  protected readonly notFound = computed(() => {
    const error = this.design.error();
    return error instanceof ApiError && error.status === HttpStatus.NotFound;
  });

  protected readonly device = signal<Device>('desktop');
  // on a phone, the only preview that makes sense is the phone one
  private readonly onPhone = afterNextRender(() => {
    if (matchMedia('(max-width: 767px)').matches) this.device.set('phone');
  });
  protected readonly kind = signal<PlaceholderKind>('album');
  /** The visitor's own cover, as a data URL. It stays on their device. */
  protected readonly cover = signal<string | null>(null);
  /** Said once the visitor tries something only a real release does. */
  protected readonly note = signal<string | null>(null);
  protected readonly playback = signal<ArtistPagePlayback>({
    trackPosition: null,
    playing: false,
  });

  protected readonly message = signal('');
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly payload = computed(() =>
    placeholderRelease(this.kind(), this.page()?.slots ?? [], this.cover()),
  );
  /** A design reads its content once, so a change renders it afresh. */
  protected readonly previewKey = computed(
    () => `${this.device()}|${this.kind()}|${this.cover()?.length ?? 0}`,
  );

  protected readonly price = computed(() => {
    const design = this.page()?.design;
    if (!design) return '';
    return releasePriceLabel({
      mode: design.pricingMode,
      currency: design.currency,
      minimumPrice: design.minimumPrice,
      suggestedPrice: design.suggestedPrice,
    });
  });
  protected readonly slotLabels = computed(() =>
    (this.page()?.slots ?? []).map((slot) => slot.label).join(', '),
  );

  /** Managers get it in the studio's marketplace; others sign in first. */
  protected readonly useLink = computed(() =>
    this.session.isSignedIn()
      ? ['/studio/marketplace', this.designId()]
      : ['/sign-in'],
  );
  protected readonly useQuery = computed(() =>
    this.session.isSignedIn()
      ? {}
      : { returnUrl: `/studio/marketplace/${this.designId()}` },
  );

  protected readonly releasesShelf = computed<Shelf | null>(() => {
    const releases = this.page()?.releases ?? [];
    return releases.length
      ? {
          id: 'design-releases',
          title: 'On real releases',
          reason: 'hear it with real music',
          items: releases,
        }
      : null;
  });

  private readonly music = new PlaceholderMusic();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.music.stop());
    effect(() => {
      if (this.notFound()) this.meta.notFound();
      const page = this.page();
      if (!page) return;
      this.meta.set({
        title: `${page.design.name}, a release design`,
        description:
          page.design.description ??
          `A design for release pages on IME${page.designer?.username ? ` by @${page.designer.username}` : ''}.`,
        image: null,
      });
    });
  }

  protected play(position: number): void {
    this.music.play(position);
    this.playback.set({ trackPosition: position, playing: true });
  }

  protected buy(): void {
    this.note.set("On a real release, that opens IME's checkout.");
  }

  protected stop(): void {
    this.music.stop();
    this.playback.update((playback) => ({ ...playback, playing: false }));
  }

  protected async pickCover(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.cover.set(await readCover(file));
      this.note.set('Your cover is only shown here. It is not uploaded.');
    } catch {
      this.note.set('That file could not be read as an image.');
    }
  }

  protected async ask(): Promise<void> {
    this.sending.set(true);
    this.error.set(null);
    const result = await this.api.designs.requestCommission(
      this.designId(),
      this.message(),
    );
    this.sending.set(false);
    if (result.ok) this.sent.set(true);
    else this.error.set(result.error.message);
  }
}
