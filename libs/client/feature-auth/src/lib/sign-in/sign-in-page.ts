import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '@ime/api-service';
import { RetroWindow } from '@ime/ui';

/**
 * Sign-in page: a chrome window over the desktop holding the email and
 * password form.
 */
@Component({
  selector: 'ime-sign-in-page',
  templateUrl: './sign-in-page.html',
  imports: [ReactiveFormsModule, RouterLink, RetroWindow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1' },
})
export class SignInPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  /**
   * Email and password credentials.
   */
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  /**
   * Server error to display, or null.
   */
  protected readonly error = signal<string | null>(null);

  /**
   * Whether a submission is in flight.
   */
  protected readonly busy = signal(false);

  /**
   * Sign in and return to the desktop on success.
   */
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    const result = await this.api.user.signIn(email, password);
    this.busy.set(false);

    if (result.ok) {
      await this.router.navigateByUrl('/');
      return;
    }
    this.error.set(result.error.message);
  }
}
