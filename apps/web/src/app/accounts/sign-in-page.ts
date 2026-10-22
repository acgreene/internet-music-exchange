import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  email,
  form,
  FormField,
  required,
  submit,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '@ime/client-data';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'ime-sign-in-page',
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
    <ime-auth-layout heading="Sign in">
      @if (confirmed()) {
        <ime-alert tone="success"
          >Your email is confirmed. Sign in to continue.</ime-alert
        >
      }
      @if (error(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }
      <form class="flex flex-col gap-4" novalidate (submit)="onSubmit($event)">
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
        <ime-field
          label="Password"
          [errors]="form.password().errors()"
          [touched]="form.password().touched()"
        >
          <input
            imeInput
            type="password"
            autocomplete="current-password"
            [formField]="form.password"
          />
        </ime-field>
        <button imeButton type="submit" [busy]="form().submitting()">
          Sign in
        </button>
      </form>
      <div class="flex justify-between text-sm">
        <a class="text-ink-muted hover:text-ink" routerLink="/forgot-password">
          Forgot your password?
        </a>
        <a class="text-ink-muted hover:text-ink" routerLink="/sign-up">
          Create an account
        </a>
      </div>
    </ime-auth-layout>
  `,
})
export class SignInPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** Where to go once signed in, as the sign-in guard sends it. */
  public readonly returnUrl = input<string>();
  /** Set when the user arrives from the confirmation email. */
  public readonly confirmed = input<string>();

  protected readonly error = signal<string | null>(null);
  protected readonly model = signal({ email: '', password: '' });
  protected readonly form = form(this.model, (path) => {
    required(path.email, { message: 'Enter your email address.' });
    email(path.email, { message: 'Enter a valid email address.' });
    required(path.password, { message: 'Enter your password.' });
  });

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.form, async () => {
      const { email, password } = this.model();
      const result = await this.session.signIn(email, password);
      if (!result.ok) {
        this.error.set(result.error.message);
        return undefined;
      }
      await this.router.navigateByUrl(this.returnUrl() || '/');
      return undefined;
    });
  }
}
