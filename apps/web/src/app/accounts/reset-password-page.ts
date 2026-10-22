import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { AuthLayout } from './auth-layout';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Where a reset link lands. The link signs the user in, so they can choose a
 * new password here.
 */
@Component({
  selector: 'ime-reset-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthLayout,
    AlertComponent,
    ButtonDirective,
    FieldComponent,
    FormField,
    InputDirective,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <ime-auth-layout heading="Choose a new password">
      @switch (session.status()) {
        @case ('loading') {
          <ime-spinner />
        }
        @case ('signed-out') {
          <p class="text-ink-muted">
            This link has expired or was already used. Ask for a new one.
          </p>
          <a imeButton variant="secondary" routerLink="/forgot-password">
            Send a new link
          </a>
        }
        @case ('signed-in') {
          @if (done()) {
            <ime-alert tone="success">Your password is changed.</ime-alert>
            <a imeButton routerLink="/">Continue</a>
          } @else {
            @if (error(); as message) {
              <ime-alert tone="error">{{ message }}</ime-alert>
            }
            <form
              class="flex flex-col gap-4"
              novalidate
              (submit)="onSubmit($event)"
            >
              <ime-field
                label="New password"
                hint="At least 8 characters."
                [errors]="form.password().errors()"
                [touched]="form.password().touched()"
              >
                <input
                  imeInput
                  type="password"
                  autocomplete="new-password"
                  [formField]="form.password"
                />
              </ime-field>
              <ime-field
                label="Confirm new password"
                [errors]="form.confirm().errors()"
                [touched]="form.confirm().touched()"
              >
                <input
                  imeInput
                  type="password"
                  autocomplete="new-password"
                  [formField]="form.confirm"
                />
              </ime-field>
              <button imeButton type="submit" [busy]="form().submitting()">
                Change password
              </button>
            </form>
          }
        }
      }
    </ime-auth-layout>
  `,
})
export class ResetPasswordPage {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiClient);

  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly model = signal({ password: '', confirm: '' });
  protected readonly form = form(this.model, (path) => {
    required(path.password, { message: 'Choose a password.' });
    minLength(path.password, MIN_PASSWORD_LENGTH, {
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
    validate(path.confirm, ({ value, valueOf }) =>
      value() === valueOf(path.password)
        ? undefined
        : { kind: 'mismatch', message: 'The passwords do not match.' },
    );
  });

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.form, async () => {
      const result = await this.api.user.update({
        password: this.model().password,
      });
      if (result.ok) this.done.set(true);
      else this.error.set(result.error.message);
      return undefined;
    });
  }
}
