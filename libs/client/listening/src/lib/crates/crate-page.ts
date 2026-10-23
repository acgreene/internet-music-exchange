import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { SessionService, currentValue } from '@ime/client-data';
import { ApiError, type CrateItem, genreName, HttpStatus } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { type MenuAction, MoreMenu } from '../more-menu';
import { PageMetaService } from '../page-meta';
import { openReport } from '../reporting/report-button';
import { CrateCard } from './crate-card';
import { CrateList } from './crate-list';
import { CrateMosaic } from './crate-mosaic';

/**
 * A crate, `/crates/<id>`, like a playlist of whole records: its covers,
 * name, note, who made it, and how many saved it, then its records in order
 * with why each is there, then more crates by its maker and others with its
 * records. Its maker can rename it, make it public or private, reorder it,
 * and take records out; anyone else can save it.
 */
@Component({
  selector: 'ime-crate-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CrateCard,
    CrateList,
    CrateMosaic,
    InputDirective,
    MoreMenu,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (page(); as page) {
      <div class="mx-auto flex max-w-4xl flex-col gap-8">
        <header class="flex flex-col gap-4">
          <a class="link w-fit text-sm" routerLink="/crates">All crates</a>
          <div
            class="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end md:grid-cols-[14rem_minmax(0,1fr)]"
          >
            <ime-crate-mosaic
              class="w-48 sm:w-full"
              [coverUrls]="page.crate.coverUrls"
            />
            <div class="flex min-w-0 flex-col gap-3">
              @if (editing()) {
                <div
                  class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
                >
                  <input
                    imeInput
                    maxlength="80"
                    aria-label="Crate name"
                    [value]="draftName()"
                    (input)="draftName.set($any($event.target).value)"
                  />
                  <textarea
                    imeInput
                    rows="3"
                    maxlength="500"
                    aria-label="Note"
                    placeholder="What is this crate? (optional)"
                    [value]="draftNote()"
                    (input)="draftNote.set($any($event.target).value)"
                  ></textarea>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      [checked]="draftPublic()"
                      (change)="draftPublic.set($any($event.target).checked)"
                    />
                    Public: anyone can see it, dig it, and save it
                  </label>
                  <div class="flex flex-wrap gap-2">
                    <button imeButton [busy]="busy()" (click)="save()">
                      Save
                    </button>
                    <button
                      imeButton
                      variant="ghost"
                      (click)="editing.set(false)"
                    >
                      Cancel
                    </button>
                    <button
                      imeButton
                      variant="ghost"
                      class="ml-auto"
                      (click)="remove()"
                    >
                      {{
                        confirmingDelete()
                          ? 'Delete it for good'
                          : 'Delete crate'
                      }}
                    </button>
                  </div>
                </div>
              } @else {
                <span
                  class="font-mono text-xs tracking-wider text-ink-muted uppercase"
                >
                  {{ labelLine() }}
                </span>
                <h1
                  class="text-4xl leading-[0.95] font-black tracking-[-0.05em] text-balance md:text-6xl"
                >
                  {{ page.crate.name }}
                </h1>
                @if (page.crate.note; as note) {
                  <p class="max-w-prose leading-relaxed whitespace-pre-line">
                    {{ note }}
                  </p>
                }
              }
              <p class="text-sm">
                by
                @if (page.maker.username; as username) {
                  <a
                    class="link font-semibold"
                    [routerLink]="['/users', username]"
                    >&#64;{{ username }}</a
                  >
                } @else {
                  someone on IME
                }
                <span class="text-ink-muted">, {{ bylineRest() }}</span>
              </p>
              <div class="flex flex-wrap items-center gap-2">
                @if (page.items.length) {
                  <a
                    imeButton
                    size="sm"
                    [routerLink]="['/dig/crates', page.crate.id]"
                    >Dig this crate</a
                  >
                }
                @if (page.isMine) {
                  @if (!editing()) {
                    <button
                      imeButton
                      variant="secondary"
                      size="sm"
                      (click)="edit()"
                    >
                      Edit crate
                    </button>
                  }
                } @else if (session.status() === 'signed-out') {
                  <a
                    imeButton
                    variant="secondary"
                    size="sm"
                    routerLink="/sign-in"
                    [queryParams]="{ returnUrl: router.url }"
                    >Save</a
                  >
                } @else {
                  <button
                    imeButton
                    variant="secondary"
                    size="sm"
                    [attr.aria-pressed]="saved()"
                    [busy]="busy()"
                    (click)="toggleSave()"
                  >
                    {{ saved() ? 'Saved' : 'Save' }}
                  </button>
                }
                @if (!page.isMine) {
                  <ime-more-menu
                    label="More for this crate"
                    [actions]="crateActions()"
                  />
                }
              </div>
              @if (error(); as error) {
                <ime-alert tone="error">{{ error }}</ime-alert>
              }
            </div>
          </div>
        </header>

        <ime-crate-list
          [items]="items()"
          [editable]="page.isMine"
          [emptyText]="
            page.isMine
              ? 'Add records from any release page with “Add to crate”.'
              : 'Nothing in this crate yet.'
          "
          (move)="move($event.index, $event.by)"
          (remove)="takeOut($event)"
          (noteChange)="setNote($event.releaseId, $event.note)"
        />

        @if (related(); as related) {
          @if (related.byMaker.length) {
            <section
              class="flex flex-col gap-4"
              aria-labelledby="by-maker-heading"
            >
              <h2
                id="by-maker-heading"
                class="text-2xl font-extrabold tracking-[-0.035em]"
              >
                More crates by &#64;{{ page.maker.username }}
              </h2>
              <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                @for (other of related.byMaker; track other.id) {
                  <li><ime-crate-card [crate]="other" [byLine]="false" /></li>
                }
              </ul>
            </section>
          }
          @if (related.withRecords.length) {
            <section
              class="flex flex-col gap-4"
              aria-labelledby="with-records-heading"
            >
              <h2
                id="with-records-heading"
                class="text-2xl font-extrabold tracking-[-0.035em]"
              >
                Crates with these records
              </h2>
              <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                @for (other of related.withRecords; track other.id) {
                  <li><ime-crate-card [crate]="other" /></li>
                }
              </ul>
            </section>
          }
        }
      </div>
    } @else if (crate.error()) {
      <div class="mx-auto flex max-w-4xl flex-col gap-2">
        <h1 class="text-3xl font-extrabold">
          {{ notFound() ? 'Crate not found' : 'Something went wrong' }}
        </h1>
        <p class="text-ink-muted">
          {{
            notFound()
              ? 'It may be private, or its maker deleted it.'
              : 'The crate could not be loaded. Try again in a moment.'
          }}
        </p>
      </div>
    } @else {
      <ime-spinner />
    }
  `,
})
export class CratePage {
  private readonly api = inject(ApiClient);
  private readonly injector = inject(Injector);
  protected readonly router = inject(Router);
  private readonly meta = inject(PageMetaService);
  protected readonly session = inject(SessionService);

  /** The `crateId` route parameter. */
  public readonly crateId = input.required<string>();

  protected readonly crate = resource({
    id: 'crate',
    params: () => ({
      id: this.crateId(),
      viewer: this.session.user()?.id ?? null,
    }),
    loader: async ({ params }) => unwrap(await this.api.crates.get(params.id)),
  });
  protected readonly page = computed(() => currentValue(this.crate));
  protected readonly notFound = computed(() => {
    const error = this.crate.error();
    return error instanceof ApiError && error.status === HttpStatus.NotFound;
  });

  /** The records, changed here at once while the crate saves. */
  protected readonly items = linkedSignal<CrateItem[]>(
    () => this.page()?.items ?? [],
  );
  protected readonly saved = linkedSignal(() => this.page()?.saved ?? false);
  protected readonly saves = linkedSignal(() => this.page()?.crate.saves ?? 0);
  protected readonly genreName = genreName;

  private readonly relatedResource = resource({
    params: () =>
      this.page()?.crate.visibility === 'public' ? this.crateId() : undefined,
    loader: async ({ params }) => unwrap(await this.api.crates.related(params)),
  });
  protected readonly related = computed(() =>
    currentValue(this.relatedResource),
  );

  /** What it is, how many records, and its genres, along the top. */
  protected readonly labelLine = computed(() => {
    const page = this.page();
    if (!page) return '';
    const count = page.crate.itemCount;
    return [
      page.crate.visibility === 'public' ? 'Crate' : 'Private crate',
      `${count} ${count === 1 ? 'record' : 'records'}`,
      ...page.genres.map((genre) => genreName(genre)),
    ].join(' // ');
  });
  /** After the maker's name: who they are, and how many saved it. */
  protected readonly bylineRest = computed(() => {
    const page = this.page();
    if (!page) return '';
    const saves = this.saves();
    return [
      this.makerRole(),
      page.crate.visibility === 'public'
        ? `${saves} ${saves === 1 ? 'save' : 'saves'}`
        : null,
    ]
      .filter(Boolean)
      .join(', ');
  });

  protected readonly crateActions = computed<MenuAction[]>(() => [
    { label: 'Report', run: () => this.report() },
  ]);

  protected readonly editing = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly draftName = signal('');
  protected readonly draftNote = signal('');
  protected readonly draftPublic = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Whether the maker is a listener, or makes music or designs too. */
  protected readonly makerRole = computed(() => {
    const maker = this.page()?.maker;
    if (!maker) return '';
    const artist = maker.artists[0];
    if (artist) {
      const more = maker.artists.length - 1;
      return `artist, ${artist.name}${more > 0 ? ` and ${more} more` : ''}`;
    }
    return maker.designer ? 'designer' : 'listener';
  });

  constructor() {
    effect(() => {
      if (this.notFound()) this.meta.notFound();
      const page = this.page();
      if (!page) return;
      this.meta.set({
        title: `${page.crate.name}, a crate${page.maker.username ? ` by @${page.maker.username}` : ''}`,
        description:
          page.crate.note ?? `${page.crate.itemCount} records picked on IME.`,
        image: page.crate.coverUrls[0] ?? null,
      });
    });
  }

  protected edit(): void {
    const crate = this.page()?.crate;
    if (!crate) return;
    this.draftName.set(crate.name);
    this.draftNote.set(crate.note ?? '');
    this.draftPublic.set(crate.visibility === 'public');
    this.confirmingDelete.set(false);
    this.editing.set(true);
  }

  protected async save(): Promise<void> {
    const ok = await this.run(() =>
      this.api.crates.update(this.crateId(), {
        name: this.draftName(),
        note: this.draftNote() || null,
        visibility: this.draftPublic() ? 'public' : 'private',
      }),
    );
    if (ok) {
      this.editing.set(false);
      this.crate.reload();
    }
  }

  protected async remove(): Promise<void> {
    if (!this.confirmingDelete()) {
      this.confirmingDelete.set(true);
      return;
    }
    if (await this.run(() => this.api.crates.delete(this.crateId()))) {
      await this.router.navigateByUrl('/crates');
    }
  }

  protected async toggleSave(): Promise<void> {
    const save = !this.saved();
    this.saved.set(save);
    this.saves.update((count) => count + (save ? 1 : -1));
    const ok = await this.run(() =>
      save
        ? this.api.crates.save(this.crateId())
        : this.api.crates.unsave(this.crateId()),
    );
    if (!ok) {
      this.saved.set(!save);
      this.saves.update((count) => count + (save ? -1 : 1));
    }
  }

  /** A crate's words are reported through the person who wrote them. */
  private async report(): Promise<void> {
    const page = this.page();
    if (!page) return;
    if (this.session.status() === 'signed-out') {
      await this.router.navigate(['/sign-in'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    await openReport(this.injector, {
      targetType: 'user',
      targetId: page.maker.id,
      label: `the crate “${page.crate.name}”`,
    });
  }

  protected async move(index: number, by: -1 | 1): Promise<void> {
    const items = [...this.items()];
    [items[index], items[index + by]] = [items[index + by], items[index]];
    this.items.set(items);
    await this.run(() =>
      this.api.crates.reorder(
        this.crateId(),
        items.map((item) => item.release.id),
      ),
    );
  }

  protected async takeOut(releaseId: string): Promise<void> {
    this.items.update((items) =>
      items.filter((item) => item.release.id !== releaseId),
    );
    await this.run(() =>
      this.api.crates.removeRelease(this.crateId(), releaseId),
    );
  }

  protected async setNote(releaseId: string, note: string): Promise<void> {
    await this.run(() =>
      this.api.crates.setReleaseNote(this.crateId(), releaseId, note || null),
    );
  }

  private async run(call: () => Promise<ApiResult<unknown>>): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    const result = await call();
    this.busy.set(false);
    if (!result.ok) this.error.set(result.error.message);
    return result.ok;
  }
}
