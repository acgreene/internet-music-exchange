import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { type Params, Router } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import { GENRES, parseSearch, type SearchSuggestions } from '@ime/models';
import { CoverComponent } from '@ime/ui';
import { KnownPlaces } from './known-places';
import { paramsForPhrase } from './search-params';

const TYPING_PAUSE_MS = 150;
const GENRES_SUGGESTED = 3;

let nextId = 0;

interface Option {
  id: string;
  kind: 'search' | 'genre' | 'artist' | 'release' | 'tag';
  label: string;
  detail?: string;
  coverUrl?: string | null;
  /** Filters read from what was typed, shown on the search option. */
  chips?: string[];
  commands: string[];
  queryParams?: Params;
}

interface Group {
  label: string | null;
  options: Option[];
}

/**
 * The search box with suggestions as you type: run the search with any
 * filters it reads, or jump straight to a genre, artist, release, or tag.
 */
@Component({
  selector: 'ime-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent],
  host: { class: 'relative block' },
  template: `
    <form role="search" (submit)="submit($event)">
      <label
        class="flex items-center gap-2.5 rounded-control border border-line bg-canvas px-3 focus-within:outline-2 focus-within:outline-accent"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-4 shrink-0 fill-none stroke-ink stroke-2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          #field
          class="h-10 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-subtle"
          type="search"
          role="combobox"
          aria-label="Search IME"
          aria-autocomplete="list"
          aria-keyshortcuts="/"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="listboxId"
          [attr.aria-activedescendant]="active()?.id ?? null"
          [placeholder]="placeholder()"
          [value]="text()"
          (input)="type($event)"
          (keydown)="key($event)"
          (focus)="onFocus()"
          (blur)="focused.set(false)"
        />
        @if (shortcut()) {
          <kbd
            class="rounded border border-hairline px-1.5 font-mono text-[11px] text-ink-muted"
            aria-hidden="true"
            >/</kbd
          >
        }
      </label>
    </form>

    @if (open()) {
      <div
        role="listbox"
        aria-label="Suggestions"
        class="absolute inset-x-0 top-full z-30 mt-1.5 flex max-h-[70vh] flex-col overflow-y-auto rounded-card border border-line bg-surface py-1.5 shadow-lg"
        [id]="listboxId"
      >
        @for (group of groups(); track $index) {
          @if (group.label) {
            <div
              role="presentation"
              class="px-3 pt-2.5 pb-1 font-mono text-[11px] tracking-wider text-ink-muted uppercase"
            >
              {{ group.label }}
            </div>
          }
          @for (option of group.options; track option.id) {
            <div
              role="option"
              class="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm"
              [class.bg-wash]="option.id === active()?.id"
              [id]="option.id"
              [attr.aria-selected]="option.id === active()?.id"
              tabindex="-1"
              (mousedown)="$event.preventDefault()"
              (keydown.enter)="choose(option)"
              (mouseenter)="activeIndex.set(indexOf(option))"
              (click)="choose(option)"
            >
              @switch (option.kind) {
                @case ('search') {
                  <span class="min-w-0 truncate">
                    Search
                    <span class="font-semibold">“{{ option.label }}”</span>
                  </span>
                  @if (option.chips?.length) {
                    <span class="flex shrink-0 flex-wrap gap-1">
                      @for (chip of option.chips; track chip) {
                        <span
                          class="rounded-full border border-ink px-2 text-xs font-medium"
                          >{{ chip }}</span
                        >
                      }
                    </span>
                  }
                }
                @case ('release') {
                  <ime-cover
                    class="size-8 shrink-0 border border-line"
                    [src]="option.coverUrl ?? null"
                    alt=""
                  />
                  <span class="flex min-w-0 flex-col leading-tight">
                    <span class="truncate font-semibold">{{
                      option.label
                    }}</span>
                    <span class="truncate text-xs text-ink-muted">{{
                      option.detail
                    }}</span>
                  </span>
                }
                @default {
                  <span class="min-w-0 truncate font-medium">{{
                    option.label
                  }}</span>
                  @if (option.detail) {
                    <span class="ml-auto shrink-0 text-xs text-ink-muted">{{
                      option.detail
                    }}</span>
                  }
                }
              }
            </div>
          }
        }
      </div>
    }
  `,
})
export class SearchBox {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly known = inject(KnownPlaces);

  /** What the box starts with, such as the words of the current search. */
  public readonly value = input('');
  public readonly placeholder = input('Search artists, releases, genres');
  /** Show the `/` hint, where the shortcut reaches this box. */
  public readonly shortcut = input(false, { transform: booleanAttribute });

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly listboxId = `ime-search-${nextId++}`;
  protected readonly text = linkedSignal(() => this.value());
  protected readonly focused = signal(false);
  private readonly dismissed = signal(false);
  private readonly suggestions = signal<SearchSuggestions | null>(null);
  protected readonly activeIndex = signal(-1);

  private pause?: ReturnType<typeof setTimeout>;
  private latest = 0;

  protected readonly groups = computed<Group[]>(() => {
    const typed = this.text().trim();
    if (!typed) return [];
    const places = this.known.places();
    const { read } = parseSearch(typed, places);
    const groups: Group[] = [
      {
        label: null,
        options: [
          {
            id: `${this.listboxId}-search`,
            kind: 'search',
            label: typed,
            chips: read.map((filter) => filter.label),
            commands: ['/search'],
            queryParams: paramsForPhrase(typed, places),
          },
        ],
      },
    ];

    const lower = typed.toLowerCase();
    const genres = GENRES.filter((genre) =>
      genre.name.toLowerCase().includes(lower),
    )
      .sort(
        (a, b) =>
          Number(!a.name.toLowerCase().startsWith(lower)) -
          Number(!b.name.toLowerCase().startsWith(lower)),
      )
      .slice(0, GENRES_SUGGESTED);
    if (genres.length) {
      groups.push({
        label: 'Genres',
        options: genres.map((genre) => ({
          id: `${this.listboxId}-genre-${genre.id}`,
          kind: 'genre',
          label: genre.name,
          commands: ['/search'],
          queryParams: { genres: genre.id },
        })),
      });
    }

    const found = this.suggestions();
    if (found?.artists.length) {
      groups.push({
        label: 'Artists',
        options: found.artists.map((artist) => ({
          id: `${this.listboxId}-artist-${artist.handle}`,
          kind: 'artist',
          label: artist.name,
          commands: ['/artists', artist.handle],
        })),
      });
    }
    if (found?.releases.length) {
      groups.push({
        label: 'Releases',
        options: found.releases.map((release) => ({
          id: `${this.listboxId}-release-${release.artistHandle}-${release.slug}`,
          kind: 'release',
          label: release.title,
          detail: release.artistName,
          coverUrl: release.coverUrl,
          commands: ['/artists', release.artistHandle, release.slug],
        })),
      });
    }
    if (found?.tags.length) {
      groups.push({
        label: 'Tags',
        options: found.tags.map((tag) => ({
          id: `${this.listboxId}-tag-${tag.value}`,
          kind: 'tag',
          label: tag.value,
          detail: `${tag.count} ${tag.count === 1 ? 'release' : 'releases'}`,
          commands: ['/search'],
          queryParams: { q: tag.value },
        })),
      });
    }
    return groups;
  });

  private readonly options = computed(() =>
    this.groups().flatMap((group) => group.options),
  );
  protected readonly active = computed<Option | null>(
    () => this.options()[this.activeIndex()] ?? null,
  );
  protected readonly open = computed(
    () => this.focused() && !this.dismissed() && this.options().length > 0,
  );

  public focus(): void {
    this.field()?.nativeElement.focus();
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.known.load();
  }

  protected indexOf(option: Option): number {
    return this.options().indexOf(option);
  }

  protected type(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    this.dismissed.set(false);
    this.activeIndex.set(-1);
    clearTimeout(this.pause);
    // suggest from the words left once filters like "tapes" are read out
    const words = parseSearch(this.text(), this.known.places()).filters.q;
    if (!words) {
      this.suggestions.set(null);
      return;
    }
    this.pause = setTimeout(() => this.fetch(words), TYPING_PAUSE_MS);
  }

  protected key(event: KeyboardEvent): void {
    const count = this.options().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!count) return;
      event.preventDefault();
      this.dismissed.set(false);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.update((index) => (index + step + count) % count);
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.dismissed.set(true);
      this.activeIndex.set(-1);
    } else if (event.key === 'Enter' && this.open() && this.active()) {
      event.preventDefault();
      this.choose(this.active() as Option);
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const search = this.options()[0];
    if (search) this.choose(search);
  }

  protected async choose(option: Option): Promise<void> {
    this.dismissed.set(true);
    this.activeIndex.set(-1);
    this.field()?.nativeElement.blur();
    await this.router.navigate(option.commands, {
      queryParams: option.queryParams,
    });
  }

  private async fetch(typed: string): Promise<void> {
    const request = ++this.latest;
    const result = await this.api.catalog.suggest(typed);
    // a slower answer to an earlier keystroke must not replace a newer one
    if (request !== this.latest) return;
    this.suggestions.set(result.ok ? result.data : null);
  }
}
