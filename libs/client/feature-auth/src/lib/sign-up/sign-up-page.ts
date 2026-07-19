import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '@ime/api-service';
import { RetroWindow } from '@ime/ui';

/**
 * Group validator: the password and confirmation fields must match.
 */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('password')?.value === group.get('confirm')?.value
    ? null
    : { mismatch: true };
}

/**
 * Sign-up page: a chrome window over the desktop holding the account
 * creation form.
 */
@Component({
  selector: 'ime-sign-up-page',
  templateUrl: './sign-up-page.html',
  imports: [ReactiveFormsModule, RouterLink, RetroWindow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1' },
})
export class SignUpPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  /**
   * Email plus password with confirmation; passwords must match and be at
   * least 8 characters, mirroring the API contract.
   */
  protected readonly form = this.formBuilder.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  /**
   * Server error to display, or null.
   */
  protected readonly error = signal<string | null>(null);

  /**
   * Whether a submission is in flight.
   */
  protected readonly busy = signal(false);

  /**
   * Create the account and land on the desktop signed in.
   */
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    const result = await this.api.user.signUp(email, password);
    this.busy.set(false);

    if (result.ok) {
      await this.router.navigateByUrl('/');
      return;
    }
    this.error.set(result.error.message);
  }
}
