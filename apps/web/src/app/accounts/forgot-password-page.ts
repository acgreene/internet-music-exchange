import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import {
  email,
  form,
  FormField,
  required,
  submit,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'ime-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthLayout,
    AlertComponent,
    ButtonDirective,
    FieldComponent,
    FormField,
    InputDirective,
    RouterLink,
  ],
  template: `
    <ime-auth-layout heading="Reset your password">
      @if (sent()) {
        <p class="text-ink-muted">
          If an account uses {{ model().email }}, we sent it a link to choose a
          new password.
        </p>
        <a imeButton variant="secondary" routerLink="/sign-in"
          >Back to sign in</a
        >
      } @else {
        <p class="text-ink-muted">
          Enter your email and we will send you a link to choose a new password.
        </p>
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <form
          class="flex flex-col gap-4"
          novalidate
          (submit)="onSubmit($event)"
        >
          <ime-field
            label="Email"
            [errors]="form.email().errors()"
            [touched]="form.email().touched()"
          >
            <input
              imeInput
              type="email"
              autocomplete="email"
              [formField]="form.email"
            />
          </ime-field>
          <button imeButton type="submit" [busy]="form().submitting()">
            Send link
          </button>
        </form>
      }
    </ime-auth-layout>
  `,
})
export class ForgotPasswordPage {
  private readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);

  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly model = signal({ email: '' });
  protected readonly form = form(this.model, (path) => {
    required(path.email, { message: 'Enter your email address.' });
    email(path.email, { message: 'Enter a valid email address.' });
  });

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.form, async () => {
      const origin = this.document.location.origin;
      const result = await this.api.user.requestPasswordReset(
        this.model().email,
        `${origin}/reset-password`,
      );
      // the same answer whether or not the address has an account
      if (result.ok || result.error.status !== 429) {
        this.sent.set(true);
      } else {
        this.error.set('Too many requests. Please try again later.');
      }
      return undefined;
    });
  }
}
