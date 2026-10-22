import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';
import { StudioService } from '../studio.service';
import { HandleField } from './handle-field';

/**
 * A new artist, with the signed-in user as its first manager.
 */
@Component({
  selector: 'ime-create-artist-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    FieldComponent,
    FormField,
    HandleField,
    InputDirective,
  ],
  template: `
    <div class="mx-auto flex max-w-xl flex-col gap-6">
      <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
        Create an artist
      </h1>
      <form class="flex flex-col gap-4" novalidate (submit)="create($event)">
        <ime-field
          label="Name"
          hint="As listeners will see it."
          [errors]="artistForm.name().errors()"
          [touched]="artistForm.name().touched()"
        >
          <input imeInput [formField]="artistForm.name" />
        </ime-field>
        <ime-handle-field
          [(handle)]="handle"
          (availability)="handleTaken.set($event === 'taken')"
        />
        <ime-field label="Bio" hint="Optional. You can add it later.">
          <textarea imeInput rows="4" [formField]="artistForm.bio"></textarea>
        </ime-field>
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div>
          <button
            imeButton
            type="submit"
            [busy]="artistForm().submitting()"
            [disabled]="handleTaken()"
          >
            Create artist
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CreateArtistPage {
  private readonly api = inject(ApiClient);
  private readonly studio = inject(StudioService);
  private readonly router = inject(Router);

  private readonly model = signal({ name: '', bio: '' });
  protected readonly artistForm = form(this.model, (path) => {
    required(path.name, { message: 'Give the artist a name.' });
  });
  protected readonly handle = signal('');
  protected readonly handleTaken = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.artistForm, async () => {
      const { name, bio } = this.model();
      const result = await this.api.artists.create({
        name: name.trim(),
        handle: this.handle().trim() || undefined,
        bio: bio.trim() || null,
      });
      if (!result.ok) {
        this.error.set(result.error.message);
        return undefined;
      }
      this.studio.artists.reload();
      await this.router.navigate(['/studio/artists', result.data.id]);
      return undefined;
    });
  }
}
