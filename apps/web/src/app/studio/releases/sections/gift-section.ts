import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { ApiClient } from '@ime/api-client';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';

/**
 * Give a listener the release outright, found by username.
 */
@Component({
  selector: 'ime-gift-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    FieldComponent,
    FormField,
    InputDirective,
  ],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="gift-heading">
      <div>
        <h2 id="gift-heading" class="text-lg font-semibold">Gift a copy</h2>
        <p class="text-sm text-ink-muted">
          It goes straight into their library, free and for good.
        </p>
      </div>
      <form class="flex items-end gap-2" novalidate (submit)="gift($event)">
        <ime-field
          class="flex-1"
          label="Username"
          [errors]="giftForm.username().errors()"
          [touched]="giftForm.username().touched()"
        >
          <input imeInput autocomplete="off" [formField]="giftForm.username" />
        </ime-field>
        <button
          imeButton
          type="submit"
          variant="secondary"
          [busy]="giftForm().submitting()"
        >
          Gift
        </button>
      </form>
      @if (sentTo(); as username) {
        <ime-alert tone="success"
          >{{ username }} now owns this release.</ime-alert
        >
      }
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
    </section>
  `,
})
export class GiftSection {
  private readonly api = inject(ApiClient);

  public readonly releaseId = input.required<string>();

  private readonly model = signal({ username: '' });
  protected readonly giftForm = form(this.model, (path) => {
    required(path.username, { message: 'Whose library should it go to?' });
  });
  protected readonly sentTo = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected async gift(event: Event): Promise<void> {
    event.preventDefault();
    this.sentTo.set(null);
    this.error.set(null);
    await submit(this.giftForm, async () => {
      const username = this.model().username.trim();
      const result = await this.api.releases.gift(this.releaseId(), username);
      if (result.ok) {
        this.sentTo.set(username);
        this.giftForm().reset({ username: '' });
      } else {
        this.error.set(result.error.message);
      }
      return undefined;
    });
  }
}
