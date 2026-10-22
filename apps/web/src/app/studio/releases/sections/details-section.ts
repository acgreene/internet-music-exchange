import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { ApiClient } from '@ime/api-client';
import type { ManagedReleaseResponse, ReleaseKind } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';
import { RELEASE_KINDS } from '../release-options';

/**
 * A release's title, kind, release date, and address.
 */
@Component({
  selector: 'ime-details-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    FieldComponent,
    FormField,
    InputDirective,
  ],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="details-heading">
      <h2 id="details-heading" class="text-lg font-semibold">Details</h2>
      <form
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
        novalidate
        (submit)="save($event)"
      >
        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <ime-field
            label="Title"
            [errors]="detailsForm.title().errors()"
            [touched]="detailsForm.title().touched()"
          >
            <input imeInput [formField]="detailsForm.title" />
          </ime-field>
          <ime-field label="Kind">
            <select imeInput [formField]="detailsForm.kind">
              @for (kind of kinds; track kind.value) {
                <option [value]="kind.value">{{ kind.label }}</option>
              }
            </select>
          </ime-field>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <ime-field
            label="Release date"
            hint="Optional. When it first came out."
          >
            <input imeInput type="date" [formField]="detailsForm.releasedAt" />
          </ime-field>
          <ime-field
            label="Address"
            [hint]="'/artists/…/' + (model().slug || 'title')"
          >
            <input imeInput spellcheck="false" [formField]="detailsForm.slug" />
          </ime-field>
        </div>
        @if (saved()) {
          <ime-alert tone="success">Saved.</ime-alert>
        }
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div>
          <button
            imeButton
            type="submit"
            variant="secondary"
            [busy]="detailsForm().submitting()"
          >
            Save details
          </button>
        </div>
      </form>
    </section>
  `,
})
export class DetailsSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedReleaseResponse>();
  public readonly changed = output<void>();

  protected readonly kinds = RELEASE_KINDS;
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly model = linkedSignal(() => {
    const release = this.managed().release;
    return {
      title: release.title,
      kind: release.kind as ReleaseKind,
      releasedAt: release.releasedAt ?? '',
      slug: release.slug,
    };
  });
  protected readonly detailsForm = form(this.model, (path) => {
    required(path.title, { message: 'Give it a title.' });
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saved.set(false);
    this.error.set(null);
    await submit(this.detailsForm, async () => {
      const { title, kind, releasedAt, slug } = this.model();
      const result = await this.api.releases.update(this.managed().release.id, {
        title: title.trim(),
        kind,
        releasedAt: releasedAt || null,
        slug: slug.trim(),
      });
      if (result.ok) {
        this.saved.set(true);
        this.changed.emit();
      } else {
        this.error.set(result.error.message);
      }
      return undefined;
    });
  }
}
