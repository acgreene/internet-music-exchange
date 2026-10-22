import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { SessionService, currentValue } from '@ime/client-data';
import { ApiError, HttpStatus, type CrateItem } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { PageMetaService } from '../page-meta';
import { ReportButton } from '../reporting/report-button';
import { CrateList } from './crate-list';

/**
 * A crate, `/crates/<id>`: its records in order with why each is there, who
 * made it, and following them. Its maker can rename it, make it public or
 * private, reorder it, and take records out.
 */
@Component({
  selector: 'ime-crate-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CrateList,
    InputDirective,
    ReportButton,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (page(); as page) {
      <div class="mx-auto flex max-w-4xl flex-col gap-8">
        <header class="flex flex-col gap-3">
          <a class="link w-fit text-sm" routerLink="/crates">All crates</a>
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
                Public: anyone can see it, dig it, and follow you for more
              </label>
              <div class="flex flex-wrap gap-2">
                <button imeButton [busy]="busy()" (click)="save()">Save</button>
                <button imeButton variant="ghost" (click)="editing.set(false)">
                  Cancel
                </button>
                <button
                  imeButton
                  variant="ghost"
                  class="ml-auto"
                  (click)="remove()"
                >
                  {{
                    confirmingDelete() ? 'Delete it for good' : 'Delete crate'
                  }}
                </button>
              </div>
            </div>
          } @else {
            <span
              class="font-mono text-xs tracking-wider text-ink-muted uppercase"
            >
              {{
                page.crate.visibility === 'public' ? 'Crate' : 'Private crate'
              }}
              · {{ page.crate.itemCount }}
              {{ page.crate.itemCount === 1 ? 'record' : 'records' }}
            </span>
            <h1
              class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-5xl"
            >
              {{ page.crate.name }}
            </h1>
            @if (page.crate.note; as note) {
              <p class="max-w-prose leading-relaxed whitespace-pre-line">
                {{ note }}
              </p>
            }
          }

          <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span>
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
              <span class="text-ink-muted">· {{ makerRole() }}</span>
            </span>
            <span class="text-ink-muted"
              >{{ page.maker.followers }}
              {{ page.maker.followers === 1 ? 'follower' : 'followers' }}</span
            >
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
            } @else if (session.isSignedIn()) {
              <button
                imeButton
                [variant]="following() ? 'secondary' : 'primary'"
                size="sm"
                [busy]="busy()"
                (click)="toggleFollow()"
              >
                {{ following() ? 'Following' : 'Follow' }}
              </button>
              <ime-report-button
                targetType="user"
                [targetId]="page.maker.id"
                [label]="'@' + (page.maker.username ?? 'this person')"
              />
            }
          </div>
          @if (error(); as error) {
            <ime-alert tone="error">{{ error }}</ime-alert>
          }
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
  private readonly router = inject(Router);
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
  protected readonly following = linkedSignal(
    () => this.page()?.followingMaker ?? false,
  );

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

  protected async toggleFollow(): Promise<void> {
    const maker = this.page()?.maker;
    if (!maker) return;
    const follow = !this.following();
    this.following.set(follow);
    const ok = await this.run(() =>
      follow
        ? this.api.crates.followMaker(maker.id)
        : this.api.crates.unfollowMaker(maker.id),
    );
    if (!ok) this.following.set(!follow);
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
