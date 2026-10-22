import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  email,
  form,
  FormField,
  minLength,
  required,
  submit,
  validate,
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

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'ime-sign-up-page',
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
    @if (checkEmail()) {
      <ime-auth-layout heading="Check your email">
        <p class="text-ink-muted">
          We sent a link to {{ model().email }}. Open it to confirm your
          address, then sign in.
        </p>
        <a imeButton variant="secondary" routerLink="/sign-in">Go to sign in</a>
      </ime-auth-layout>
    } @else {
      <ime-auth-layout heading="Create your account">
        <p class="text-ink-muted">
          One account to buy, own, and follow, and to sell or design whenever
          you want to.
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
          <ime-field
            label="Password"
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
          <div class="flex flex-col gap-1.5">
            <label class="flex items-start gap-2 text-sm">
              <input
                class="mt-0.5"
                type="checkbox"
                [formField]="form.acceptedTerms"
              />
              <span>
                I accept the
                <a class="link" routerLink="/terms" target="_blank"
                  >terms of service</a
                >
                and the
                <a class="link" routerLink="/privacy" target="_blank"
                  >privacy policy</a
                >.
              </span>
            </label>
            @if (form.acceptedTerms().touched()) {
              @if (form.acceptedTerms().errors()[0]; as termsError) {
                <span class="text-sm text-danger" role="alert">{{
                  termsError.message
                }}</span>
              }
            }
          </div>
          <button imeButton type="submit" [busy]="form().submitting()">
            Create account
          </button>
        </form>
        <p class="text-sm text-ink-muted">
          Already have an account?
          <a class="text-ink underline" routerLink="/sign-in">Sign in</a>
        </p>
      </ime-auth-layout>
    }
  `,
})
export class SignUpPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);
  protected readonly checkEmail = signal(false);
  protected readonly model = signal({
    email: '',
    password: '',
    acceptedTerms: false,
  });
  protected readonly form = form(this.model, (path) => {
    required(path.email, { message: 'Enter your email address.' });
    email(path.email, { message: 'Enter a valid email address.' });
    required(path.password, { message: 'Choose a password.' });
    minLength(path.password, MIN_PASSWORD_LENGTH, {
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
    validate(path.acceptedTerms, ({ value }) =>
      value()
        ? undefined
        : {
            kind: 'terms',
            message: 'Accept the terms and privacy policy to continue.',
          },
    );
  });

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.form, async () => {
      const { email, password } = this.model();
      const result = await this.session.signUp(email, password);
      if (!result.ok) {
        this.error.set(result.error.message);
      } else if ('confirmationRequired' in result.data) {
        this.checkEmail.set(true);
      } else {
        // every user has a username, so a new one chooses theirs first
        await this.router.navigateByUrl('/account');
      }
      return undefined;
    });
  }
}
