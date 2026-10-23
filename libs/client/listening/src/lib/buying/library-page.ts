import { DatePipe } from '@angular/common';
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
import type { LibraryItem } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  ReleaseCardComponent,
  SpinnerComponent,
} from '@ime/ui';
import { currentValue } from '@ime/client-data';

const PAGE_SIZE = 48;

const SOURCE_LABELS: Record<LibraryItem['source'], string> = {
  purchase: 'Bought',
  free: 'Free',
  gift: 'Gift',
};

/**
 * Everything the listener owns, newest first. Each opens to its release
 * page, where an owner plays every track and downloads the originals.
 */
@Component({
  selector: 'ime-library-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    ReleaseCardComponent,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Library</h1>
      @if (firstPage.error()) {
        <ime-alert tone="error">Your library could not be loaded.</ime-alert>
      }
      <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        @for (item of items(); track item.releaseId) {
          <li class="flex flex-col gap-1">
            <ime-release-card
              [title]="item.title"
              [link]="['/artists', item.artistHandle, item.slug]"
              [coverUrl]="item.coverUrl"
              [subtitle]="item.artistName"
              [subtitleLink]="['/artists', item.artistHandle]"
            />
            <span class="text-xs text-ink-subtle">
              {{ sourceLabel(item.source) }},
              {{ item.acquiredAt | date: 'mediumDate' }}
            </span>
          </li>
        } @empty {
          @if (firstPage.hasValue()) {
            <li class="col-span-full text-ink-muted">
              Nothing here yet. Music you buy or get for free lands here, ready
              to stream and download.
              <a class="link" routerLink="/">Find something.</a>
            </li>
          }
        }
      </ul>
      @if (firstPage.isLoading()) {
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
    </div>
  `,
})
export class LibraryPage {
  private readonly api = inject(ApiClient);

  protected readonly firstPage = resource({
    loader: async () =>
      unwrap(await this.api.catalog.getLibrary({ limit: PAGE_SIZE })),
  });

  private readonly more = signal<LibraryItem[]>([]);
  private readonly lastPageSize = signal(PAGE_SIZE);
  protected readonly loadingMore = signal(false);

  protected readonly items = computed(() => [
    ...(currentValue(this.firstPage) ?? []),
    ...this.more(),
  ]);
  protected readonly hasMore = computed(
    () =>
      (currentValue(this.firstPage)?.length ?? 0) === PAGE_SIZE &&
      this.lastPageSize() === PAGE_SIZE,
  );

  protected sourceLabel(source: LibraryItem['source']): string {
    return SOURCE_LABELS[source];
  }

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    const result = await this.api.catalog.getLibrary({
      limit: PAGE_SIZE,
      offset: this.items().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }
}
