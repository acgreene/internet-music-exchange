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
import { ApiClient } from '@ime/api-client';
import {
  GENRES,
  type GenreId,
  genreName,
  isGenreId,
  MAX_GENRES,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  type ManagedReleaseResponse,
  normalizeTag,
} from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';

const CHIP =
  'inline-flex items-center gap-1 rounded-control border border-line bg-canvas py-1 pr-1 pl-2.5 text-sm';

/**
 * A release's genres and tags, which listeners browse, search, and dig by.
 */
@Component({
  selector: 'ime-sound-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, FieldComponent, InputDirective],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="sound-heading">
      <div>
        <h2 id="sound-heading" class="text-lg font-semibold">
          Genres and tags
        </h2>
        <p class="text-sm text-ink-muted">
          Listeners browse, search, and dig by these, so pick what someone
          looking for this sound would look for.
        </p>
      </div>
      <div
        class="flex flex-col gap-5 rounded-card border border-line bg-surface p-4"
      >
        <ime-field
          label="Genres"
          [hint]="'Up to ' + maxGenres + ', most fitting first.'"
        >
          <div class="flex flex-col gap-2">
            @if (genres().length) {
              <ul class="flex flex-wrap gap-2" aria-label="Chosen genres">
                @for (genre of genres(); track genre) {
                  <li [class]="chip">
                    {{ name(genre) }}
                    <button
                      type="button"
                      class="rounded-control px-1.5 text-ink-muted hover:bg-line hover:text-ink"
                      [attr.aria-label]="'Remove ' + name(genre)"
                      (click)="removeGenre(genre)"
                    >
                      ×
                    </button>
                  </li>
                }
              </ul>
            }
            <select
              imeInput
              class="sm:max-w-64"
              aria-label="Add a genre"
              [disabled]="genres().length >= maxGenres"
              (change)="addGenre($event)"
            >
              <option value="">
                {{
                  genres().length >= maxGenres
                    ? 'Remove one to change it'
                    : 'Add a genre…'
                }}
              </option>
              @for (genre of choices(); track genre.id) {
                <option [value]="genre.id">{{ genre.name }}</option>
              }
            </select>
          </div>
        </ime-field>

        <ime-field
          label="Tags"
          [hint]="
            'Up to ' +
            maxTags +
            ' words for its sound and mood, like late night or field recordings. Press Enter to add one.'
          "
          [errors]="tagErrors()"
        >
          <div class="flex flex-col gap-2">
            @if (tags().length) {
              <ul class="flex flex-wrap gap-2" aria-label="Tags">
                @for (tag of tags(); track tag) {
                  <li [class]="chip">
                    {{ tag }}
                    <button
                      type="button"
                      class="rounded-control px-1.5 text-ink-muted hover:bg-line hover:text-ink"
                      [attr.aria-label]="'Remove ' + tag"
                      (click)="removeTag(tag)"
                    >
                      ×
                    </button>
                  </li>
                }
              </ul>
            }
            <input
              imeInput
              class="sm:max-w-64"
              aria-label="Add a tag"
              [maxLength]="maxTagLength"
              [placeholder]="
                tags().length >= maxTags
                  ? 'Remove one to add another'
                  : 'Add a tag'
              "
              [disabled]="tags().length >= maxTags"
              [value]="draft()"
              (input)="draft.set($any($event.target).value)"
              (keydown.enter)="addTag($event)"
              (keydown.comma)="addTag($event)"
            />
          </div>
        </ime-field>

        @if (saved()) {
          <ime-alert tone="success">Saved.</ime-alert>
        }
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div>
          <button
            imeButton
            type="button"
            variant="secondary"
            [busy]="saving()"
            (click)="save()"
          >
            Save genres and tags
          </button>
        </div>
      </div>
    </section>
  `,
})
export class SoundSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedReleaseResponse>();
  public readonly changed = output<void>();

  protected readonly chip = CHIP;
  protected readonly maxGenres = MAX_GENRES;
  protected readonly maxTags = MAX_TAGS;
  protected readonly maxTagLength = MAX_TAG_LENGTH;
  protected readonly name = genreName;

  protected readonly genres = linkedSignal(
    () => this.managed().release.genres as GenreId[],
  );
  protected readonly tags = linkedSignal(() => this.managed().release.tags);
  protected readonly choices = computed(() =>
    GENRES.filter((genre) => !this.genres().includes(genre.id)),
  );

  protected readonly draft = signal('');
  protected readonly tagError = signal<string | null>(null);
  protected readonly tagErrors = computed(() => {
    const message = this.tagError();
    return message ? [{ message }] : [];
  });
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  protected addGenre(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    select.value = '';
    if (!isGenreId(id) || this.genres().length >= MAX_GENRES) return;
    this.genres.update((genres) => [...genres, id]);
    this.saved.set(false);
  }

  protected removeGenre(id: GenreId): void {
    this.genres.update((genres) => genres.filter((genre) => genre !== id));
    this.saved.set(false);
  }

  protected addTag(event: Event): void {
    event.preventDefault();
    if (!this.draft().trim()) return;
    const tag = normalizeTag(this.draft());
    if (!tag) {
      this.tagError.set(
        'Tags use letters, numbers, spaces, hyphens, apostrophes, and &.',
      );
      return;
    }
    this.tagError.set(null);
    this.draft.set('');
    if (!this.tags().includes(tag)) this.tags.update((tags) => [...tags, tag]);
    this.saved.set(false);
  }

  protected removeTag(tag: string): void {
    this.tags.update((tags) => tags.filter((other) => other !== tag));
    this.saved.set(false);
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    const result = await this.api.releases.update(this.managed().release.id, {
      genres: this.genres(),
      tags: this.tags(),
    });
    this.saving.set(false);
    if (result.ok) {
      this.saved.set(true);
      this.changed.emit();
    } else {
      this.error.set(result.error.message);
    }
  }
}
