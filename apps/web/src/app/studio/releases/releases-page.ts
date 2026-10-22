import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  resource,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import type { ReleaseKind } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { StudioService } from '../studio.service';
import { RELEASE_KINDS, STATUS_LABELS } from './release-options';

/**
 * An artist's releases, drafts first in mind, and a quick way to start one.
 */
@Component({
  selector: 'ime-releases-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    FieldComponent,
    FormField,
    InputDirective,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-4xl flex-col gap-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-2xl font-semibold tracking-tight">Releases</h1>
        <button
          imeButton
          [variant]="creating() ? 'secondary' : 'primary'"
          (click)="creating.set(!creating())"
        >
          {{ creating() ? 'Cancel' : 'New release' }}
        </button>
      </div>

      @if (creating()) {
        <form
          class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
          novalidate
          (submit)="create($event)"
        >
          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <ime-field
              label="Title"
              [errors]="newForm.title().errors()"
              [touched]="newForm.title().touched()"
            >
              <input imeInput [formField]="newForm.title" />
            </ime-field>
            <ime-field label="Kind">
              <select imeInput [formField]="newForm.kind">
                @for (kind of kinds; track kind.value) {
                  <option [value]="kind.value">{{ kind.label }}</option>
                }
              </select>
            </ime-field>
          </div>
          <ime-field
            label="Release date"
            hint="Optional. When it first came out, if it already has."
          >
            <input imeInput type="date" [formField]="newForm.releasedAt" />
          </ime-field>
          @if (createError(); as message) {
            <ime-alert tone="error">{{ message }}</ime-alert>
          }
          <div>
            <button imeButton type="submit" [busy]="newForm().submitting()">
              Create draft
            </button>
          </div>
        </form>
      }

      @if (releases.hasValue() ? releases.value() : null; as list) {
        <ul
          class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
        >
          @for (release of list; track release.id) {
            <li>
              <a
                class="flex items-center justify-between gap-4 p-4 hover:bg-surface-muted"
                [routerLink]="['/studio/releases', release.id]"
              >
                <span class="flex min-w-0 flex-col">
                  <span class="truncate font-medium">{{ release.title }}</span>
                  <span class="text-sm text-ink-muted">
                    {{ kindLabel(release.kind) }} · created
                    {{ release.createdAt | date: 'mediumDate' }}
                  </span>
                </span>
                <span
                  class="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium"
                >
                  {{ statusLabel(release.status) }}
                </span>
              </a>
            </li>
          } @empty {
            <li class="p-4 text-ink-muted">
              No releases yet. Start one with New release.
            </li>
          }
        </ul>
      } @else if (releases.error()) {
        <ime-alert tone="error">The releases could not be loaded.</ime-alert>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class ReleasesPage {
  private readonly api = inject(ApiClient);
  private readonly studio = inject(StudioService);
  private readonly router = inject(Router);

  protected readonly kinds = RELEASE_KINDS;
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly releases = resource({
    params: () => this.studio.currentArtistId() ?? undefined,
    loader: async ({ params }) =>
      unwrap(await this.api.releases.listForArtist(params)),
  });

  private readonly draft = signal({
    title: '',
    kind: 'album' as ReleaseKind,
    releasedAt: '',
  });
  protected readonly newForm = form(this.draft, (path) => {
    required(path.title, { message: 'Give it a title.' });
  });

  protected kindLabel(kind: ReleaseKind): string {
    return RELEASE_KINDS.find((option) => option.value === kind)?.label ?? kind;
  }

  protected statusLabel(status: keyof typeof STATUS_LABELS): string {
    return STATUS_LABELS[status];
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    const artistId = this.studio.currentArtistId();
    if (!artistId) return;
    this.createError.set(null);
    await submit(this.newForm, async () => {
      const { title, kind, releasedAt } = this.draft();
      const result = await this.api.releases.create(artistId, {
        title: title.trim(),
        kind,
        releasedAt: releasedAt || null,
      });
      if (!result.ok) {
        this.createError.set(result.error.message);
        return undefined;
      }
      await this.router.navigate(['/studio/releases', result.data.id]);
      return undefined;
    });
  }
}
