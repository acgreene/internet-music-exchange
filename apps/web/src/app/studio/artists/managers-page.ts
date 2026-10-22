import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  resource,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import type { ArtistManagerResponse } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { StudioService } from '../studio.service';

/**
 * Who manages the artist. Every manager has the same say; the last one can
 * never leave.
 */
@Component({
  selector: 'ime-managers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    FieldComponent,
    FormField,
    InputDirective,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Managers</h1>
        <p class="text-sm text-ink-muted">
          Managers can do everything for the artist, including adding and
          removing other managers, and they share its hosting costs.
        </p>
      </div>

      @if (managers.hasValue() ? managers.value() : null; as list) {
        <ul
          class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
        >
          @for (manager of list; track manager.userId) {
            <li class="flex items-center justify-between gap-4 p-4">
              <span class="flex flex-col">
                <span class="font-medium">
                  {{ manager.name || manager.username || 'A manager' }}
                  @if (manager.userId === session.user()?.id) {
                    <span class="font-normal text-ink-muted">(you)</span>
                  }
                </span>
                <span class="text-sm text-ink-muted">
                  @if (manager.username) {
                    &#64;{{ manager.username }} ·
                  }
                  since {{ manager.createdAt | date: 'mediumDate' }}
                </span>
              </span>
              @if (list.length > 1) {
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  (click)="remove(manager)"
                >
                  {{
                    manager.userId === session.user()?.id ? 'Leave' : 'Remove'
                  }}
                </button>
              }
            </li>
          }
        </ul>
      } @else if (managers.error()) {
        <ime-alert tone="error">The managers could not be loaded.</ime-alert>
      } @else {
        <ime-spinner />
      }

      <form class="flex items-end gap-2" novalidate (submit)="add($event)">
        <ime-field
          class="flex-1"
          label="Add a manager by username"
          [errors]="addForm.username().errors()"
          [touched]="addForm.username().touched()"
        >
          <input imeInput autocomplete="off" [formField]="addForm.username" />
        </ime-field>
        <button
          imeButton
          type="submit"
          variant="secondary"
          [busy]="addForm().submitting()"
        >
          Add
        </button>
      </form>
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </div>
  `,
})
export class ManagersPage {
  private readonly api = inject(ApiClient);
  private readonly studio = inject(StudioService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly managers = resource({
    params: () => this.studio.currentArtistId() ?? undefined,
    loader: async ({ params }) =>
      unwrap(await this.api.artists.listManagers(params)),
  });

  private readonly model = signal({ username: '' });
  protected readonly addForm = form(this.model, (path) => {
    required(path.username, { message: 'Enter their username.' });
  });
  protected readonly error = signal<string | null>(null);

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    const artistId = this.studio.currentArtistId();
    if (!artistId) return;
    this.error.set(null);
    await submit(this.addForm, async () => {
      const result = await this.api.artists.addManager(artistId, {
        username: this.model().username.trim(),
      });
      if (result.ok) {
        this.addForm().reset({ username: '' });
        this.managers.reload();
      } else {
        this.error.set(result.error.message);
      }
      return undefined;
    });
  }

  protected async remove(manager: ArtistManagerResponse): Promise<void> {
    const artistId = this.studio.currentArtistId();
    if (!artistId) return;
    this.error.set(null);
    const result = await this.api.artists.removeManager(
      artistId,
      manager.userId,
    );
    if (!result.ok) {
      this.error.set(result.error.message);
      return;
    }
    if (manager.userId === this.session.user()?.id) {
      // no longer theirs to manage
      this.studio.artists.reload();
      await this.router.navigateByUrl('/studio');
      return;
    }
    this.managers.reload();
  }
}
