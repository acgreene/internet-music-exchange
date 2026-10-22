import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { ApiClient, unwrap } from '@ime/api-client';
import { uploadFile, currentValue } from '@ime/client-data';
import type { ArtistImageKind } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  CoverComponent,
  FieldComponent,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { StudioService } from '../studio.service';
import { HandleField } from './handle-field';

interface LinkRow {
  label: string;
  url: string;
}

/**
 * The artist's public profile: name, handle, bio, links, avatar and header.
 */
@Component({
  selector: 'ime-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CoverComponent,
    FieldComponent,
    FormField,
    HandleField,
    InputDirective,
    SpinnerComponent,
  ],
  template: `
    @if (studio.currentArtist(); as artist) {
      <div class="flex max-w-3xl flex-col gap-10">
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Profile</h1>

        <section class="flex flex-col gap-4" aria-labelledby="about-heading">
          <h2 id="about-heading" class="text-lg font-semibold">About</h2>
          <form
            class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
            novalidate
            (submit)="saveAbout($event)"
          >
            <ime-field
              label="Name"
              [errors]="aboutForm.name().errors()"
              [touched]="aboutForm.name().touched()"
            >
              <input imeInput [formField]="aboutForm.name" />
            </ime-field>
            <ime-handle-field
              [(handle)]="handle"
              [artistId]="artist.id"
              [current]="artist.handle"
              (availability)="handleTaken.set($event === 'taken')"
            />
            <ime-field label="Bio">
              <textarea
                imeInput
                rows="5"
                [formField]="aboutForm.bio"
              ></textarea>
            </ime-field>
            @if (aboutSaved()) {
              <ime-alert tone="success">Saved.</ime-alert>
            }
            @if (aboutError(); as message) {
              <ime-alert tone="error">{{ message }}</ime-alert>
            }
            <div>
              <button
                imeButton
                type="submit"
                variant="secondary"
                [busy]="aboutForm().submitting()"
                [disabled]="handleTaken()"
              >
                Save
              </button>
            </div>
          </form>
        </section>

        <section class="flex flex-col gap-4" aria-labelledby="images-heading">
          <h2 id="images-heading" class="text-lg font-semibold">Images</h2>
          <div
            class="grid gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-[10rem_minmax(0,1fr)]"
          >
            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium">Avatar</span>
              <ime-cover
                class="w-40 rounded-full"
                [src]="profileData()?.avatarUrl ?? null"
                alt="Avatar"
              />
              <div class="flex gap-2">
                <label
                  imeButton
                  variant="secondary"
                  size="sm"
                  class="cursor-pointer"
                >
                  Upload
                  <input
                    class="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    (change)="uploadImage('avatar', $event)"
                  />
                </label>
                @if (profileData()?.avatarUrl) {
                  <button
                    imeButton
                    variant="ghost"
                    size="sm"
                    (click)="removeImage('avatar')"
                  >
                    Remove
                  </button>
                }
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium">Header</span>
              @if (profileData()?.headerUrl; as headerUrl) {
                <img
                  class="aspect-[4/1] w-full rounded-control object-cover"
                  [src]="headerUrl"
                  alt="Header"
                />
              } @else {
                <div
                  class="aspect-[4/1] w-full rounded-control bg-surface-muted"
                ></div>
              }
              <div class="flex gap-2">
                <label
                  imeButton
                  variant="secondary"
                  size="sm"
                  class="cursor-pointer"
                >
                  Upload
                  <input
                    class="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    (change)="uploadImage('header', $event)"
                  />
                </label>
                @if (profileData()?.headerUrl) {
                  <button
                    imeButton
                    variant="ghost"
                    size="sm"
                    (click)="removeImage('header')"
                  >
                    Remove
                  </button>
                }
              </div>
            </div>
            <p class="text-sm text-ink-muted sm:col-span-2">
              JPEG, PNG, or WebP, up to 5 MB. The header shows wide, about 4 by
              1.
            </p>
            @if (imageWorking()) {
              <ime-spinner label="Uploading" />
            }
            @if (imageError(); as message) {
              <ime-alert class="sm:col-span-2" tone="error">{{
                message
              }}</ime-alert>
            }
          </div>
        </section>

        <section class="flex flex-col gap-4" aria-labelledby="links-heading">
          <h2 id="links-heading" class="text-lg font-semibold">Links</h2>
          <div
            class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
          >
            @for (link of links(); track $index; let index = $index) {
              <div class="flex flex-wrap items-center gap-2">
                <input
                  imeInput
                  class="w-40"
                  placeholder="Label"
                  [attr.aria-label]="'Label of link ' + (index + 1)"
                  [value]="link.label"
                  (input)="editLink(index, 'label', $event)"
                />
                <input
                  imeInput
                  class="min-w-48 flex-1"
                  type="url"
                  placeholder="https://"
                  [attr.aria-label]="'Address of link ' + (index + 1)"
                  [value]="link.url"
                  (input)="editLink(index, 'url', $event)"
                />
                <button
                  imeButton
                  variant="ghost"
                  size="sm"
                  [attr.aria-label]="'Remove link ' + (index + 1)"
                  (click)="removeLink(index)"
                >
                  Remove
                </button>
              </div>
            } @empty {
              <p class="text-sm text-ink-muted">
                Your website, socials, or anywhere else people can find you.
              </p>
            }
            <div class="flex gap-2">
              <button imeButton variant="ghost" size="sm" (click)="addLink()">
                Add link
              </button>
              <button
                imeButton
                variant="secondary"
                size="sm"
                [busy]="linksSaving()"
                (click)="saveLinks()"
              >
                Save links
              </button>
            </div>
            @if (linksSaved()) {
              <ime-alert tone="success">Links saved.</ime-alert>
            }
            @if (linksError(); as message) {
              <ime-alert tone="error">{{ message }}</ime-alert>
            }
          </div>
        </section>
      </div>
    } @else {
      <ime-spinner />
    }
  `,
})
export class ProfilePage {
  private readonly api = inject(ApiClient);
  protected readonly studio = inject(StudioService);

  protected readonly profile = resource({
    params: () => this.studio.currentArtist()?.handle,
    loader: async ({ params }) =>
      unwrap(await this.api.artists.getProfile(params)),
  });

  protected readonly profileData = computed(() => currentValue(this.profile));

  private readonly about = linkedSignal(() => {
    const artist = this.studio.currentArtist();
    return { name: artist?.name ?? '', bio: artist?.bio ?? '' };
  });
  protected readonly aboutForm = form(this.about, (path) => {
    required(path.name, { message: 'The artist needs a name.' });
  });
  protected readonly handle = linkedSignal(
    () => this.studio.currentArtist()?.handle ?? '',
  );
  protected readonly handleTaken = signal(false);
  protected readonly aboutSaved = signal(false);
  protected readonly aboutError = signal<string | null>(null);

  protected readonly imageWorking = signal(false);
  protected readonly imageError = signal<string | null>(null);

  protected readonly links = linkedSignal<LinkRow[]>(
    () =>
      currentValue(this.profile)?.links.map(({ label, url }) => ({
        label,
        url,
      })) ?? [],
  );
  protected readonly linksSaving = signal(false);
  protected readonly linksSaved = signal(false);
  protected readonly linksError = signal<string | null>(null);

  private readonly artistId = computed(
    () => this.studio.currentArtistId() ?? '',
  );

  protected async saveAbout(event: Event): Promise<void> {
    event.preventDefault();
    this.aboutSaved.set(false);
    this.aboutError.set(null);
    await submit(this.aboutForm, async () => {
      const { name, bio } = this.about();
      const result = await this.api.artists.update(this.artistId(), {
        name: name.trim(),
        handle: this.handle().trim(),
        bio: bio.trim() || null,
      });
      if (result.ok) {
        this.aboutSaved.set(true);
        this.studio.artists.reload();
      } else {
        this.aboutError.set(result.error.message);
      }
      return undefined;
    });
  }

  protected async uploadImage(
    kind: ArtistImageKind,
    event: Event,
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.imageWorking.set(true);
    this.imageError.set(null);
    const error = await this.sendImage(kind, file);
    this.imageWorking.set(false);
    if (error) this.imageError.set(error);
    else this.profile.reload();
  }

  /** Upload and record an image, returning what went wrong, if anything. */
  private async sendImage(
    kind: ArtistImageKind,
    file: File,
  ): Promise<string | null> {
    const target = await this.api.artists.createImageUpload(
      this.artistId(),
      kind,
      file.type,
    );
    if (!target.ok) return target.error.message;
    try {
      await uploadFile(target.data.uploadUrl, file);
    } catch (error) {
      return error instanceof Error ? error.message : 'The upload failed.';
    }
    const confirmed = await this.api.artists.confirmImage(
      this.artistId(),
      kind,
      target.data.objectKey,
    );
    return confirmed.ok ? null : confirmed.error.message;
  }

  protected async removeImage(kind: ArtistImageKind): Promise<void> {
    const result = await this.api.artists.removeImage(this.artistId(), kind);
    if (result.ok) this.profile.reload();
    else this.imageError.set(result.error.message);
  }

  protected addLink(): void {
    this.links.update((links) => [...links, { label: '', url: '' }]);
  }

  protected removeLink(index: number): void {
    this.links.update((links) => links.filter((_, at) => at !== index));
  }

  protected editLink(index: number, field: keyof LinkRow, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.links.update((links) =>
      links.map((link, at) =>
        at === index ? { ...link, [field]: value } : link,
      ),
    );
  }

  protected async saveLinks(): Promise<void> {
    this.linksSaved.set(false);
    this.linksError.set(null);
    const links = this.links()
      .map(({ label, url }) => ({ label: label.trim(), url: url.trim() }))
      .filter((link) => link.label || link.url);
    this.linksSaving.set(true);
    const result = await this.api.artists.setLinks(this.artistId(), links);
    this.linksSaving.set(false);
    if (result.ok) {
      this.linksSaved.set(true);
      this.profile.reload();
    } else {
      this.linksError.set(result.error.message);
    }
  }
}
