import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  required,
  submit,
  email,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
} from '@ime/ui';

const RELEASE_PATH = /\/artists\/([^/?#]+)\/([^/?#]+)/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Record a copyright claim a rights holder sent to IME's contact address.
 * It joins the queue like any other report.
 */
@Component({
  selector: 'ime-copyright-claim-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    FieldComponent,
    FormField,
    InputDirective,
  ],
  template: `
    <div class="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
          Record a copyright claim
        </h1>
        <p class="text-sm text-ink-muted">
          For claims sent to IME by email. The claimant needs no account; the
          claim is reviewed in the queue like any report.
        </p>
      </div>
      <form
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
        novalidate
        (submit)="save($event)"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <ime-field
            label="Claimant's name"
            [errors]="claim.claimantName().errors()"
            [touched]="claim.claimantName().touched()"
          >
            <input imeInput [formField]="claim.claimantName" />
          </ime-field>
          <ime-field
            label="Claimant's email"
            [errors]="claim.claimantEmail().errors()"
            [touched]="claim.claimantEmail().touched()"
          >
            <input imeInput type="email" [formField]="claim.claimantEmail" />
          </ime-field>
        </div>
        <ime-field
          label="Release"
          hint="Its page address, or its id."
          [errors]="claim.release().errors()"
          [touched]="claim.release().touched()"
        >
          <input
            imeInput
            placeholder="https://…/artists/handle/release"
            [formField]="claim.release"
          />
        </ime-field>
        <ime-field
          label="What the claim says"
          hint="Optional. The work it infringes, and how."
        >
          <textarea imeInput rows="4" [formField]="claim.note"></textarea>
        </ime-field>
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div>
          <button imeButton type="submit" [busy]="claim().submitting()">
            Record the claim
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CopyrightClaimPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  private readonly draft = signal({
    claimantName: '',
    claimantEmail: '',
    release: '',
    note: '',
  });
  protected readonly claim = form(this.draft, (path) => {
    required(path.claimantName, { message: 'Who sent it?' });
    required(path.claimantEmail, { message: 'Where can they be reached?' });
    email(path.claimantEmail, { message: 'That is not an email address.' });
    required(path.release, { message: 'Which release?' });
  });
  protected readonly error = signal<string | null>(null);

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    await submit(this.claim, async () => {
      const { claimantName, claimantEmail, release, note } = this.draft();
      const releaseId = await this.findRelease(release.trim());
      if (!releaseId) {
        this.error.set('No release found at that address or id.');
        return undefined;
      }
      const result = await this.api.admin.recordCopyrightClaim({
        claimantName: claimantName.trim(),
        claimantEmail: claimantEmail.trim(),
        releaseId,
        note: note.trim() || null,
      });
      if (!result.ok) {
        this.error.set(result.error.message);
        return undefined;
      }
      await this.router.navigate(['/admin/cases', 'release', releaseId]);
      return undefined;
    });
  }

  private async findRelease(value: string): Promise<string | null> {
    if (ID.test(value)) return value;
    const match = RELEASE_PATH.exec(value);
    if (!match) return null;
    const page = await this.api.catalog.getReleasePage(
      decodeURIComponent(match[1]),
      decodeURIComponent(match[2]),
    );
    return page.ok ? page.data.release.id : null;
  }
}
