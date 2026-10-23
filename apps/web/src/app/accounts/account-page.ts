import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  form,
  FormField,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { ApiClient } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';

const MIN_PASSWORD_LENGTH = 8;

type Availability = 'unchanged' | 'checking' | 'available' | 'taken';

@Component({
  selector: 'ime-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    FieldComponent,
    FormField,
    InputDirective,
  ],
  templateUrl: './account-page.html',
})
export class AccountPage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly profileModel = signal({ username: '', name: '' });
  protected readonly profileForm = form(this.profileModel, (path) => {
    required(path.username, { message: 'Choose a username.' });
  });
  protected readonly profileSaved = signal(false);
  protected readonly profileError = signal<string | null>(null);

  protected readonly passwordModel = signal({ password: '', confirm: '' });
  protected readonly passwordForm = form(this.passwordModel, (path) => {
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
  protected readonly passwordSaved = signal(false);
  protected readonly passwordError = signal<string | null>(null);

  /** A new account has no username until its owner chooses one. */
  protected readonly needsUsername = computed(
    () =>
      this.session.status() === 'signed-in' && !this.session.user()?.username,
  );

  protected readonly hidePurchases = computed(
    () => this.session.user()?.hidePurchases ?? false,
  );
  protected readonly savingPrivacy = signal(false);
  protected readonly privacyError = signal<string | null>(null);

  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  private readonly typedUsername = computed(() =>
    this.profileModel().username.trim(),
  );

  private readonly checkedAvailability = toSignal(
    toObservable(this.typedUsername).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(async (username): Promise<Availability> => {
        if (!username) {
          return 'unchanged';
        }
        const result = await this.api.user.isUsernameAvailable(username);
        return result.ok && !result.data.available ? 'taken' : 'available';
      }),
    ),
    { initialValue: 'unchanged' as Availability },
  );

  /** Whether the username being typed is free, checked as the user types. */
  protected readonly availability = computed<Availability>(() =>
    this.typedUsername() === this.session.user()?.username
      ? 'unchanged'
      : this.checkedAvailability(),
  );

  protected readonly usernameErrors = computed(() => [
    ...this.profileForm.username().errors(),
    ...(this.availability() === 'taken'
      ? [{ message: 'That username is taken.' }]
      : []),
  ]);

  constructor() {
    // start from the profile as it is, once it has loaded
    effect(() => {
      const user = this.session.user();
      if (user) {
        this.profileModel.set({
          username: user.username ?? '',
          name: user.name ?? '',
        });
      }
    });
  }

  protected async saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    this.profileSaved.set(false);
    this.profileError.set(null);
    await submit(this.profileForm, async () => {
      const { username, name } = this.profileModel();
      const result = await this.api.user.updateProfile({
        username: username.trim(),
        name: name.trim() || null,
      });
      if (result.ok) {
        await this.session.refresh();
        this.profileSaved.set(true);
      } else {
        this.profileError.set(result.error.message);
      }
      return undefined;
    });
  }

  protected async setHidePurchases(hide: boolean): Promise<void> {
    this.savingPrivacy.set(true);
    this.privacyError.set(null);
    const result = await this.api.user.updateProfile({ hidePurchases: hide });
    if (result.ok) await this.session.refresh();
    else this.privacyError.set(result.error.message);
    this.savingPrivacy.set(false);
  }

  protected async savePassword(event: Event): Promise<void> {
    event.preventDefault();
    this.passwordSaved.set(false);
    this.passwordError.set(null);
    await submit(this.passwordForm, async () => {
      const result = await this.api.user.update({
        password: this.passwordModel().password,
      });
      if (result.ok) {
        this.passwordSaved.set(true);
        this.passwordForm().reset({ password: '', confirm: '' });
      } else {
        this.passwordError.set(result.error.message);
      }
      return undefined;
    });
  }

  protected async deleteAccount(): Promise<void> {
    this.deleting.set(true);
    this.deleteError.set(null);
    const result = await this.api.user.deleteAccount();
    this.deleting.set(false);
    if (!result.ok) {
      this.deleteError.set(result.error.message);
      return;
    }
    await this.session.signOut();
    await this.router.navigateByUrl('/');
  }
}
