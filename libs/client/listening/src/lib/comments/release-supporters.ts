import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  required,
  submit,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { SessionService, currentValue } from '@ime/client-data';
import type { CommentResponse } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';
import { type MenuAction, MoreMenu } from '../more-menu';
import { openReport } from '../reporting/report-button';

const PAGE_SIZE = 20;
const MAX_LENGTH = 2000;
/** Notes shown before "Show all". */
const NOTES_SHOWN = 3;

/** Soft backgrounds for people's initials, picked by their name. */
const TONES = [
  '#dce6ff',
  '#fff27a',
  '#ffd9cc',
  '#d3f0e2',
  '#eadcff',
  '#f1e7d8',
];

/**
 * Who supported a release, the people who bought or claimed it, and the
 * notes they left. Owners leave a note, and edit or delete their own; the
 * artist's managers can delete any.
 */
@Component({
  selector: 'ime-release-supporters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    FieldComponent,
    FormField,
    InputDirective,
    MoreMenu,
    RouterLink,
  ],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="supporters-heading">
      <div class="flex items-baseline justify-between gap-4">
        <h2
          id="supporters-heading"
          class="font-mono text-xs tracking-wider text-ink-muted uppercase"
        >
          Supported by
        </h2>
        @if (supporterTotal()) {
          <span class="font-mono text-xs text-ink-muted"
            >{{ supporterTotal() }}
            {{ supporterTotal() === 1 ? 'person' : 'people' }}</span
          >
        }
      </div>

      @if (firstPage.error()) {
        <ime-alert tone="error">The notes could not be loaded.</ime-alert>
      }
      @if (shownNotes().length) {
        <ul class="flex flex-col gap-4">
          @for (note of shownNotes(); track note.id) {
            <li class="flex flex-col gap-1">
              @if (editingId() === note.id) {
                <form
                  class="flex flex-col gap-2"
                  novalidate
                  (submit)="saveEdit($event, note)"
                >
                  <ime-field
                    label="Edit your note"
                    [errors]="editForm.comment().errors()"
                    [touched]="editForm.comment().touched()"
                  >
                    <textarea
                      imeInput
                      rows="3"
                      [formField]="editForm.comment"
                    ></textarea>
                  </ime-field>
                  <div class="flex gap-2">
                    <button
                      imeButton
                      type="submit"
                      size="sm"
                      [busy]="editForm().submitting()"
                    >
                      Save
                    </button>
                    <button
                      imeButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      (click)="editingId.set(null)"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              } @else {
                <p class="text-sm leading-relaxed whitespace-pre-line">
                  {{ note.comment }}
                </p>
              }
              <div class="flex items-center gap-1.5 text-xs text-ink-muted">
                <span
                  class="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-ink uppercase"
                  [style.background]="tone(note.username ?? note.userId)"
                  aria-hidden="true"
                  >{{ initial(note.name || note.username || '♪') }}</span
                >
                @if (note.username) {
                  <a
                    class="font-medium text-ink hover:underline"
                    [routerLink]="['/users', note.username]"
                    >{{ note.name || note.username }}</a
                  >
                } @else {
                  <span class="font-medium text-ink">{{
                    note.name || 'A listener'
                  }}</span>
                }
                <span
                  >· {{ note.createdAt | date: 'mediumDate' }}
                  @if (note.edited) {
                    · edited
                  }
                </span>
                <ime-more-menu
                  class="-my-1 ml-auto"
                  label="More for this note"
                  [actions]="actionsFor(note)"
                />
              </div>
            </li>
          }
        </ul>
        @if (notes().length > shownNotes().length || notes().length < total()) {
          <button
            class="link self-start text-sm"
            [disabled]="loadingMore()"
            (click)="showMore()"
          >
            Show all {{ total() }} notes
          </button>
        }
      }

      @if (supporterList().length) {
        <ul class="flex flex-wrap gap-1" aria-label="Supporters">
          @for (person of supporterList(); track $index) {
            <li>
              @if (person.username; as username) {
                <a
                  class="flex size-8 items-center justify-center rounded-full text-xs font-bold uppercase ring-ink hover:ring-2"
                  [style.background]="tone(username)"
                  [title]="person.name || username"
                  [attr.aria-label]="person.name || username"
                  [routerLink]="['/users', username]"
                  >{{ initial(person.name || username) }}</a
                >
              } @else {
                <span
                  class="flex size-8 items-center justify-center rounded-full bg-surface-muted text-xs font-bold"
                  aria-label="A listener"
                  >♪</span
                >
              }
            </li>
          }
          @if (supporterTotal() > supporterList().length) {
            <li
              class="flex h-8 items-center rounded-full border border-line px-2.5 font-mono text-xs text-ink-muted"
            >
              +{{ supporterTotal() - supporterList().length }}
            </li>
          }
        </ul>
      } @else if (supporters.hasValue()) {
        <p class="text-sm text-ink-muted">
          Nobody yet. Be the first to support it.
        </p>
      }

      @if (owned()) {
        <form class="flex flex-col gap-2" novalidate (submit)="post($event)">
          <ime-field
            label="Leave a note"
            hint="Say what it means to you. It shows here with your name."
            [errors]="draftForm.comment().errors()"
            [touched]="draftForm.comment().touched()"
          >
            <textarea
              imeInput
              rows="3"
              [formField]="draftForm.comment"
            ></textarea>
          </ime-field>
          @if (postError(); as message) {
            <ime-alert tone="error">{{ message }}</ime-alert>
          }
          <div>
            <button
              imeButton
              type="submit"
              size="sm"
              [busy]="draftForm().submitting()"
            >
              Post note
            </button>
          </div>
        </form>
      }
      @if (actionError(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </section>
  `,
})
export class ReleaseSupporters {
  private readonly api = inject(ApiClient);
  private readonly injector = inject(Injector);
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  public readonly releaseId = input.required<string>();
  /** The viewer owns the release, so may leave a note. */
  public readonly owned = input(false);
  /** The viewer manages the release's artist, so may delete any note. */
  public readonly canModerate = input(false);

  protected readonly supporters = resource({
    id: 'release-supporters',
    params: () => this.releaseId(),
    loader: async ({ params }) =>
      unwrap(await this.api.community.listSupporters(params)),
  });
  protected readonly supporterList = computed(
    () => currentValue(this.supporters)?.supporters ?? [],
  );
  protected readonly supporterTotal = computed(
    () => currentValue(this.supporters)?.total ?? 0,
  );

  protected readonly firstPage = resource({
    id: 'release-notes',
    params: () => this.releaseId(),
    loader: async ({ params }) =>
      unwrap(
        await this.api.community.listComments(params, { limit: PAGE_SIZE }),
      ),
  });

  protected readonly notes = linkedSignal<CommentResponse[]>(
    () => currentValue(this.firstPage)?.comments ?? [],
  );
  protected readonly total = linkedSignal(
    () => currentValue(this.firstPage)?.total ?? 0,
  );
  protected readonly showingAll = signal(false);
  protected readonly shownNotes = computed(() =>
    this.showingAll() ? this.notes() : this.notes().slice(0, NOTES_SHOWN),
  );
  protected readonly loadingMore = signal(false);
  protected readonly actionError = signal<string | null>(null);

  private readonly draft = signal({ comment: '' });
  protected readonly draftForm = form(this.draft, (path) => {
    required(path.comment, { message: 'Write something first.' });
    maxLength(path.comment, MAX_LENGTH, {
      message: `Notes are at most ${MAX_LENGTH} characters.`,
    });
  });
  protected readonly postError = signal<string | null>(null);

  protected readonly editingId = signal<string | null>(null);
  private readonly edit = signal({ comment: '' });
  protected readonly editForm = form(this.edit, (path) => {
    required(path.comment, { message: 'Write something first.' });
    maxLength(path.comment, MAX_LENGTH, {
      message: `Notes are at most ${MAX_LENGTH} characters.`,
    });
  });

  private readonly userId = computed(() => this.session.user()?.id);

  protected initial(name: string): string {
    return name.charAt(0);
  }

  protected tone(key: string): string {
    let hash = 0;
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return TONES[hash % TONES.length];
  }

  protected actionsFor(note: CommentResponse): MenuAction[] {
    const mine = note.userId === this.userId();
    return [
      ...(mine ? [{ label: 'Edit', run: () => this.startEdit(note) }] : []),
      ...(mine || this.canModerate()
        ? [{ label: 'Delete', run: () => this.remove(note) }]
        : []),
      ...(mine ? [] : [{ label: 'Report', run: () => this.report(note) }]),
    ];
  }

  /** Every note, fetching the rest of them the first time. */
  protected async showMore(): Promise<void> {
    this.showingAll.set(true);
    while (this.notes().length < this.total()) {
      this.loadingMore.set(true);
      const result = await this.api.community.listComments(this.releaseId(), {
        limit: PAGE_SIZE,
        offset: this.notes().length,
      });
      this.loadingMore.set(false);
      if (!result.ok) {
        this.actionError.set(result.error.message);
        return;
      }
      const known = new Set(this.notes().map((note) => note.id));
      const fresh = result.data.comments.filter((note) => !known.has(note.id));
      if (!fresh.length) return;
      this.notes.update((notes) => [...notes, ...fresh]);
      this.total.set(result.data.total);
    }
  }

  protected async post(event: Event): Promise<void> {
    event.preventDefault();
    this.postError.set(null);
    await submit(this.draftForm, async () => {
      const result = await this.api.community.addComment(
        this.releaseId(),
        this.draft().comment.trim(),
      );
      if (!result.ok) {
        this.postError.set(result.error.message);
        return undefined;
      }
      const user = this.session.user();
      const posted = result.data;
      this.notes.update((notes) => [
        {
          id: posted.id,
          userId: posted.userId,
          username: user?.username ?? null,
          name: user?.name ?? null,
          comment: posted.comment,
          edited: false,
          createdAt: posted.createdAt,
          updatedAt: posted.createdAt,
        },
        ...notes,
      ]);
      this.total.update((total) => total + 1);
      this.draftForm().reset({ comment: '' });
      return undefined;
    });
  }

  private startEdit(note: CommentResponse): void {
    this.editForm().reset({ comment: note.comment });
    this.editingId.set(note.id);
  }

  protected async saveEdit(event: Event, note: CommentResponse): Promise<void> {
    event.preventDefault();
    this.actionError.set(null);
    await submit(this.editForm, async () => {
      const text = this.edit().comment.trim();
      const result = await this.api.community.editComment(note.id, text);
      if (!result.ok) {
        this.actionError.set(result.error.message);
        return undefined;
      }
      this.notes.update((notes) =>
        notes.map((existing) =>
          existing.id === note.id
            ? { ...existing, comment: text, edited: true }
            : existing,
        ),
      );
      this.editingId.set(null);
      return undefined;
    });
  }

  private async remove(note: CommentResponse): Promise<void> {
    this.actionError.set(null);
    const result = await this.api.community.deleteComment(note.id);
    if (!result.ok) {
      this.actionError.set(result.error.message);
      return;
    }
    this.notes.update((notes) =>
      notes.filter((existing) => existing.id !== note.id),
    );
    this.total.update((total) => total - 1);
  }

  private async report(note: CommentResponse): Promise<void> {
    if (this.session.status() === 'signed-out') {
      await this.router.navigate(['/sign-in'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    await openReport(this.injector, {
      targetType: 'comment',
      targetId: note.id,
      label: 'this note',
    });
  }
}
