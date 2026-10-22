import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { StudioService } from '../studio.service';
import { CoverSection } from './sections/cover-section';
import { DesignSection } from './sections/design-section';
import { DetailsSection } from './sections/details-section';
import { ExtrasSection } from './sections/extras-section';
import { GiftSection } from './sections/gift-section';
import { PricingSection } from './sections/pricing-section';
import { TakedownNotice } from './sections/takedown-notice';
import { TracksSection } from './sections/tracks-section';
import { STATUS_LABELS } from './release-options';
import { currentValue } from '@ime/client-data';

/**
 * Everything about one release: details, cover, tracks and audio, price,
 * extras, and whether it is out.
 */
@Component({
  selector: 'ime-release-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverSection,
    DesignSection,
    DetailsSection,
    ExtrasSection,
    GiftSection,
    PricingSection,
    RouterLink,
    SpinnerComponent,
    TakedownNotice,
    TracksSection,
  ],
  template: `
    @if (release.hasValue() ? release.value() : null; as managed) {
      <div class="flex max-w-4xl flex-col gap-8">
        <header class="flex flex-col gap-3">
          <a
            class="text-sm text-ink-muted hover:underline"
            [routerLink]="['/studio/artists', managed.release.artistId]"
            >← Releases</a
          >
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
                {{ managed.release.title }}
              </h1>
              <span
                class="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium"
              >
                {{ statusLabels[managed.release.status] }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2">
              @switch (managed.release.status) {
                @case ('draft') {
                  <button
                    imeButton
                    variant="danger"
                    [busy]="working() === 'delete'"
                    (click)="remove()"
                  >
                    Delete draft
                  </button>
                  <button
                    imeButton
                    [busy]="working() === 'publish'"
                    (click)="publish()"
                  >
                    Publish
                  </button>
                }
                @case ('published') {
                  @if (studio.currentArtist(); as artist) {
                    <a
                      imeButton
                      variant="secondary"
                      [routerLink]="[
                        '/artists',
                        artist.handle,
                        managed.release.slug,
                      ]"
                      >View page</a
                    >
                  }
                  <button
                    imeButton
                    variant="secondary"
                    [busy]="working() === 'archive'"
                    (click)="archive()"
                  >
                    Archive
                  </button>
                }
                @case ('archived') {
                  <button
                    imeButton
                    [busy]="working() === 'publish'"
                    (click)="publish()"
                  >
                    Publish again
                  </button>
                }
              }
            </div>
          </div>
          @if (managed.release.status === 'archived') {
            <ime-alert
              >Archived: off the catalog and not for sale. Everyone who owns it
              keeps it.</ime-alert
            >
          }
          @if (managed.takedown; as takedown) {
            <ime-takedown-notice
              [releaseId]="managed.release.id"
              [takedown]="takedown"
              (changed)="release.reload()"
            />
          }
          @if (error(); as message) {
            <ime-alert tone="error">{{ message }}</ime-alert>
          }
          @if (confirmingDelete()) {
            <div
              class="flex flex-wrap items-center gap-3 rounded-card border border-danger/40 bg-danger/10 p-3 text-sm"
            >
              <span>Delete this draft and its files for good?</span>
              <button
                imeButton
                variant="danger"
                size="sm"
                [busy]="working() === 'delete'"
                (click)="remove()"
              >
                Delete
              </button>
              <button
                imeButton
                variant="ghost"
                size="sm"
                (click)="confirmingDelete.set(false)"
              >
                Keep it
              </button>
            </div>
          }
        </header>

        <ime-details-section [managed]="managed" (changed)="release.reload()" />
        <ime-cover-section [managed]="managed" (changed)="release.reload()" />
        <ime-tracks-section [managed]="managed" (changed)="release.reload()" />
        <ime-pricing-section [managed]="managed" (changed)="release.reload()" />
        <ime-extras-section [managed]="managed" (changed)="release.reload()" />
        <ime-design-section [managed]="managed" />
        @if (managed.release.status === 'published') {
          <ime-gift-section [releaseId]="managed.release.id" />
        }
      </div>
    } @else if (release.error(); as error) {
      <ime-alert tone="error">{{ error.message }}</ime-alert>
    } @else {
      <ime-spinner />
    }
  `,
})
export class ReleaseEditorPage {
  private readonly api = inject(ApiClient);
  protected readonly studio = inject(StudioService);
  private readonly router = inject(Router);

  public readonly releaseId = input.required<string>();

  protected readonly release = resource({
    params: () => this.releaseId(),
    loader: async ({ params }) => unwrap(await this.api.releases.get(params)),
  });

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly working = signal<'publish' | 'archive' | 'delete' | null>(
    null,
  );
  protected readonly confirmingDelete = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const artistId = currentValue(this.release)?.release.artistId;
      if (artistId) this.studio.currentArtistId.set(artistId);
    });
  }

  protected async publish(): Promise<void> {
    await this.act('publish', () =>
      this.api.releases.publish(this.releaseId()),
    );
  }

  protected async archive(): Promise<void> {
    await this.act('archive', () =>
      this.api.releases.archive(this.releaseId()),
    );
  }

  protected async remove(): Promise<void> {
    if (!this.confirmingDelete()) {
      this.confirmingDelete.set(true);
      return;
    }
    const artistId = currentValue(this.release)?.release.artistId;
    const done = await this.act('delete', () =>
      this.api.releases.delete(this.releaseId()),
    );
    if (done && artistId) {
      await this.router.navigate(['/studio/artists', artistId]);
    }
  }

  private async act(
    kind: 'publish' | 'archive' | 'delete',
    call: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ): Promise<boolean> {
    this.working.set(kind);
    this.error.set(null);
    const result = await call();
    this.working.set(null);
    if (!result.ok) {
      this.error.set(result.error?.message ?? 'That did not work.');
      return false;
    }
    if (kind !== 'delete') this.release.reload();
    return true;
  }
}
