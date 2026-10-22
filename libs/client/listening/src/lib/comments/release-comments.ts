import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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
import { SessionService } from '@ime/client-data';
import type { CommentResponse } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';

const PAGE_SIZE = 20;
const MAX_LENGTH = 2000;

/**
 * A release's comments, newest first, with a box to add one. Authors edit and
 * delete their own; the artist's managers can delete any.
 */
@Component({
  selector: 'ime-release-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    FieldComponent,
    FormField,
    InputDirective,
    RouterLink,
  ],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="comments-heading">
      <h2 id="comments-heading" class="text-lg font-semibold">
        Comments
        @if (total()) {
          <span class="font-normal text-ink-muted">({{ total() }})</span>
        }
      </h2>

      @switch (session.status()) {
        @case ('signed-in') {
          <form class="flex flex-col gap-2" novalidate (submit)="post($event)">
            <ime-field
              label="Add a comment"
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
                Post
              </button>
            </div>
          </form>
        }
        @case ('signed-out') {
          <p class="text-sm text-ink-muted">
            <a
              class="underline"
              routerLink="/sign-in"
              [queryParams]="{ returnUrl: router.url }"
              >Sign in</a
            >
            to comment.
          </p>
        }
      }

      @if (firstPage.error()) {
        <ime-alert tone="error">The comments could not be loaded.</ime-alert>
      }
      <ul class="flex flex-col divide-y divide-line">
        @for (comment of comments(); track comment.id) {
          <li class="flex flex-col gap-1 py-3">
            <div class="flex items-baseline gap-2 text-sm">
              @if (comment.username) {
                <a
                  class="font-medium hover:underline"
                  [routerLink]="['/users', comment.username]"
                  >{{ comment.name || comment.username }}</a
                >
              } @else {
                <span class="font-medium">{{
                  comment.name || 'A listener'
                }}</span>
              }
              <span class="text-ink-subtle">{{
                comment.createdAt | date: 'mediumDate'
              }}</span>
              @if (comment.edited) {
                <span class="text-ink-subtle">(edited)</span>
              }
            </div>

            @if (editingId() === comment.id) {
              <form
                class="flex flex-col gap-2"
                novalidate
                (submit)="saveEdit($event, comment)"
              >
                <ime-field
                  label="Edit your comment"
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
              <p class="text-sm whitespace-pre-line">{{ comment.comment }}</p>
              @if (isMine(comment) || canModerate()) {
                <div class="flex gap-1">
                  @if (isMine(comment)) {
                    <button
                      imeButton
                      size="sm"
                      variant="ghost"
                      (click)="startEdit(comment)"
                    >
                      Edit
                    </button>
                  }
                  <button
                    imeButton
                    size="sm"
                    variant="ghost"
                    (click)="remove(comment)"
                  >
                    Delete
                  </button>
                </div>
              }
            }
          </li>
        } @empty {
          @if (firstPage.hasValue()) {
            <li class="py-3 text-sm text-ink-muted">No comments yet.</li>
          }
        }
      </ul>
      @if (comments().length < total()) {
        <div>
          <button
            imeButton
            variant="secondary"
            size="sm"
            [busy]="loadingMore()"
            (click)="loadMore()"
          >
            Show more
          </button>
        </div>
      }
      @if (actionError(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </section>
  `,
})
export class ReleaseComments {
  private readonly api = inject(ApiClient);
  protected readonly session = inject(SessionService);
  protected readonly router = inject(Router);

  public readonly releaseId = input.required<string>();
  /** The viewer manages the release's artist, so may delete any comment. */
  public readonly canModerate = input(false);

  protected readonly firstPage = resource({
    id: 'release-comments',
    params: () => this.releaseId(),
    loader: async ({ params }) =>
      unwrap(
        await this.api.community.listComments(params, { limit: PAGE_SIZE }),
      ),
  });

  protected readonly comments = linkedSignal<CommentResponse[]>(
    () => this.firstPage.value()?.comments ?? [],
  );
  protected readonly total = linkedSignal(
    () => this.firstPage.value()?.total ?? 0,
  );
  protected readonly loadingMore = signal(false);
  protected readonly actionError = signal<string | null>(null);

  private readonly draft = signal({ comment: '' });
  protected readonly draftForm = form(this.draft, (path) => {
    required(path.comment, { message: 'Write something first.' });
    maxLength(path.comment, MAX_LENGTH, {
      message: `Comments are at most ${MAX_LENGTH} characters.`,
    });
  });
  protected readonly postError = signal<string | null>(null);

  protected readonly editingId = signal<string | null>(null);
  private readonly edit = signal({ comment: '' });
  protected readonly editForm = form(this.edit, (path) => {
    required(path.comment, { message: 'Write something first.' });
    maxLength(path.comment, MAX_LENGTH, {
      message: `Comments are at most ${MAX_LENGTH} characters.`,
    });
  });

  private readonly userId = computed(() => this.session.user()?.id);

  protected isMine(comment: CommentResponse): boolean {
    return comment.userId === this.userId();
  }

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    const result = await this.api.community.listComments(this.releaseId(), {
      limit: PAGE_SIZE,
      offset: this.comments().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) {
      this.actionError.set(result.error.message);
      return;
    }
    const known = new Set(this.comments().map((comment) => comment.id));
    this.comments.update((comments) => [
      ...comments,
      ...result.data.comments.filter((comment) => !known.has(comment.id)),
    ]);
    this.total.set(result.data.total);
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
      this.comments.update((comments) => [
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
        ...comments,
      ]);
      this.total.update((total) => total + 1);
      this.draftForm().reset({ comment: '' });
      return undefined;
    });
  }

  protected startEdit(comment: CommentResponse): void {
    this.editForm().reset({ comment: comment.comment });
    this.editingId.set(comment.id);
  }

  protected async saveEdit(
    event: Event,
    comment: CommentResponse,
  ): Promise<void> {
    event.preventDefault();
    this.actionError.set(null);
    await submit(this.editForm, async () => {
      const text = this.edit().comment.trim();
      const result = await this.api.community.editComment(comment.id, text);
      if (!result.ok) {
        this.actionError.set(result.error.message);
        return undefined;
      }
      this.comments.update((comments) =>
        comments.map((existing) =>
          existing.id === comment.id
            ? { ...existing, comment: text, edited: true }
            : existing,
        ),
      );
      this.editingId.set(null);
      return undefined;
    });
  }

  protected async remove(comment: CommentResponse): Promise<void> {
    this.actionError.set(null);
    const result = await this.api.community.deleteComment(comment.id);
    if (!result.ok) {
      this.actionError.set(result.error.message);
      return;
    }
    this.comments.update((comments) =>
      comments.filter((existing) => existing.id !== comment.id),
    );
    this.total.update((total) => total - 1);
  }
}
