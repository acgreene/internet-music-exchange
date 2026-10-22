import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { SessionService, currentValue } from '@ime/client-data';
import type { ReleaseCardWithArtist } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';
import { GatefoldHero } from '../home/gatefold-hero';
import { ShelfRow } from '../home/shelf-row';

const PAGE_SIZE = 24;

/**
 * The home page: the gatefold that says what IME is, today's shelves,
 * designed releases, and everything new.
 */
@Component({
  selector: 'ime-discover-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    GatefoldHero,
    ReleaseCardComponent,
    RouterLink,
    ShelfRow,
    SpinnerComponent,
  ],
  template: `
    <ime-gatefold-hero class="-mx-4 -mt-8 md:-mx-8" />

    <div class="mx-auto flex max-w-6xl flex-col gap-12 pt-10">
      <div id="shelves" class="flex scroll-mt-24 flex-col gap-10">
        @if (home.hasValue() ? home.value() : null; as page) {
          @for (shelf of page.shelves; track shelf.id) {
            <ime-shelf-row [shelf]="shelf" />
          }
        } @else if (home.error()) {
          <ime-alert tone="error"
            >Today's shelves could not be loaded.</ime-alert
          >
        } @else {
          <ime-spinner />
        }
      </div>

      @if (designed().length) {
        <section
          class="grid items-center gap-8 border-y border-line py-10 md:grid-cols-2"
          aria-labelledby="designed-heading"
        >
          <div class="flex flex-col gap-3">
            <span
              class="font-mono text-xs tracking-wider text-ink-muted uppercase"
              >Designed releases</span
            >
            <h2
              id="designed-heading"
              class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-5xl"
            >
              IME reimagines the record.
            </h2>
            <p class="max-w-prose leading-relaxed">
              On IME, artists team up with designers and creative developers to
              build a companion experience for their record: an immersive
              gallery, a page that changes with every song, even a small game.
              It's the cover, the inner sleeve, and the liner notes, reborn as
              software you explore while you listen.
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <a
                imeButton
                [routerLink]="[
                  '/artists',
                  designed()[0].release.artistHandle,
                  designed()[0].release.slug,
                ]"
                >Hear a designed release</a
              >
              <a class="link font-semibold" routerLink="/studio/marketplace"
                >Find a design for your music</a
              >
            </div>
          </div>
          <ul class="grid grid-cols-3 gap-3">
            @for (item of designed(); track item.release.id; let i = $index) {
              <li [class.mt-10]="i === 1">
                <a
                  class="group flex flex-col gap-1.5"
                  [routerLink]="[
                    '/artists',
                    item.release.artistHandle,
                    item.release.slug,
                  ]"
                >
                  <ime-cover
                    class="w-full border border-line"
                    [src]="item.release.coverUrl"
                    [alt]="'Cover of ' + item.release.title"
                  />
                  <span
                    class="truncate text-sm font-semibold group-hover:underline"
                    >{{ item.release.title }}</span
                  >
                </a>
              </li>
            }
          </ul>
        </section>
      }

      <section class="flex flex-col gap-4" aria-labelledby="recent-heading">
        <h2
          id="recent-heading"
          class="text-2xl font-extrabold tracking-[-0.035em]"
        >
          Everything new
        </h2>
        @if (recent.error()) {
          <ime-alert tone="error">New releases could not be loaded.</ime-alert>
        }
        <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          @for (release of releases(); track release.id) {
            <li>
              <ime-release-card
                [title]="release.title"
                [link]="['/artists', release.artistHandle, release.slug]"
                [coverUrl]="release.coverUrl"
                [subtitle]="release.artistName"
                [subtitleLink]="['/artists', release.artistHandle]"
              />
            </li>
          } @empty {
            @if (recent.hasValue()) {
              <li class="text-sm text-ink-muted">
                Nothing has been released yet.
              </li>
            }
          }
        </ul>
        @if (recent.isLoading()) {
          <ime-spinner />
        } @else if (hasMore()) {
          <div>
            <button
              imeButton
              variant="secondary"
              [busy]="loadingMore()"
              (click)="loadMore()"
            >
              Show more
            </button>
          </div>
        }
      </section>
    </div>
  `,
})
export class DiscoverPage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);

  /** The shelves change with who is signed in, so they reload with them. */
  protected readonly home = resource({
    id: 'catalog-home',
    params: () => this.session.user()?.id ?? 'anonymous',
    loader: async () => unwrap(await this.api.catalog.getHome()),
  });
  protected readonly designed = computed(() =>
    (currentValue(this.home)?.designed ?? []).flatMap((item) =>
      item.kind === 'release' ? [item] : [],
    ),
  );

  protected readonly recent = resource({
    id: 'catalog-recent',
    loader: async () =>
      unwrap(await this.api.catalog.listRecent({ limit: PAGE_SIZE })),
  });

  private readonly more = signal<ReleaseCardWithArtist[]>([]);
  private readonly lastPageSize = signal(PAGE_SIZE);
  protected readonly loadingMore = signal(false);

  protected readonly releases = computed(() => [
    ...(currentValue(this.recent) ?? []),
    ...this.more(),
  ]);
  protected readonly hasMore = computed(
    () =>
      (currentValue(this.recent)?.length ?? 0) === PAGE_SIZE &&
      this.lastPageSize() === PAGE_SIZE,
  );

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    const result = await this.api.catalog.listRecent({
      limit: PAGE_SIZE,
      offset: this.releases().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }
}
