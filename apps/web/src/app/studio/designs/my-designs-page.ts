import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue, SessionService } from '@ime/client-data';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';
import { STATUS_LABELS } from '../releases/release-options';
import { designPriceLabel } from './design-price';

/**
 * The designs the signed-in user made, starting a new one, and the licenses
 * artists have paid for.
 */
@Component({
  selector: 'ime-my-designs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    FieldComponent,
    FormField,
    InputDirective,
    MoneyPipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-4xl flex-col gap-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
            Your designs
          </h1>
          <p class="text-sm text-ink-muted">
            Release pages you build for artists. Sell them on the marketplace,
            or grant them privately for a commission.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a imeButton variant="ghost" routerLink="/studio/designs/payments"
            >Getting paid</a
          >
          <button
            imeButton
            [variant]="creating() ? 'secondary' : 'primary'"
            (click)="creating.set(!creating())"
          >
            {{ creating() ? 'Cancel' : 'New design' }}
          </button>
        </div>
      </div>

      <label
        class="flex items-start gap-3 rounded-card border border-line bg-surface p-4"
      >
        <input
          type="checkbox"
          class="mt-1"
          [checked]="openToCommissions()"
          [disabled]="savingCommissions()"
          (change)="setOpenToCommissions($any($event.target).checked)"
        />
        <span class="flex flex-col gap-0.5">
          <span class="font-semibold">Take requests for custom designs</span>
          <span class="text-sm text-ink-muted">
            Your designs in the gallery offer a way to ask you for one. Requests
            arrive by email with the asker's address; you arrange the work and
            deliver it as a private design.
          </span>
        </span>
      </label>
      @if (commissionsError(); as message) {
        <ime-alert tone="error">{{ message }}</ime-alert>
      }

      @if (creating()) {
        <form
          class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
          novalidate
          (submit)="create($event)"
        >
          <ime-field
            label="Name"
            [errors]="newForm.name().errors()"
            [touched]="newForm.name().touched()"
          >
            <input imeInput [formField]="newForm.name" />
          </ime-field>
          <ime-field
            label="Description"
            hint="Optional. Shown on the marketplace."
          >
            <textarea
              imeInput
              rows="3"
              [formField]="newForm.description"
            ></textarea>
          </ime-field>
          @if (createError(); as message) {
            <ime-alert tone="error">{{ message }}</ime-alert>
          }
          <div>
            <button imeButton type="submit" [busy]="newForm().submitting()">
              Create draft
            </button>
          </div>
        </form>
      }

      @if (designsResource.error()) {
        <ime-alert tone="error">Your designs could not be loaded.</ime-alert>
      } @else if (designs(); as designs) {
        <ul
          class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
        >
          @for (design of designs; track design.id) {
            <li>
              <a
                class="flex items-center justify-between gap-4 p-4 hover:bg-wash"
                [routerLink]="['/studio/designs', design.id]"
              >
                <span class="flex min-w-0 flex-col">
                  <span class="truncate font-medium">{{ design.name }}</span>
                  <span class="font-mono text-sm text-ink-muted">
                    {{ price(design) }}, {{ design.visibility }}
                  </span>
                </span>
                <span
                  class="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium"
                >
                  {{ statusLabels[design.status] }}
                </span>
              </a>
            </li>
          } @empty {
            <li class="p-4 text-ink-muted">
              No designs yet. Start one with New design.
            </li>
          }
        </ul>
      } @else {
        <ime-spinner />
      }

      <section class="flex flex-col gap-3" aria-labelledby="sales-heading">
        <h2 id="sales-heading" class="text-lg font-semibold">Sales</h2>
        @if (sales(); as sales) {
          <ul
            class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
          >
            @for (sale of sales; track $index) {
              <li class="flex items-center justify-between gap-4 p-4 text-sm">
                <span class="flex min-w-0 flex-col">
                  <span class="truncate font-medium">{{
                    sale.designName
                  }}</span>
                  <span class="text-ink-muted">{{
                    sale.createdAt | date: 'mediumDate'
                  }}</span>
                </span>
                <span class="font-mono" [class.line-through]="sale.refundedAt">
                  @if (sale.amount !== null && sale.currency) {
                    {{ sale.amount | money: sale.currency }}
                  } @else {
                    Free
                  }
                </span>
              </li>
            } @empty {
              <li class="p-4 text-sm text-ink-muted">No paid licenses yet.</li>
            }
          </ul>
        } @else if (salesResource.error()) {
          <ime-alert tone="error">Your sales could not be loaded.</ime-alert>
        } @else {
          <ime-spinner />
        }
      </section>
    </div>
  `,
})
export class MyDesignsPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  protected readonly openToCommissions = computed(
    () => this.session.user()?.openToCommissions ?? false,
  );
  protected readonly savingCommissions = signal(false);
  protected readonly commissionsError = signal<string | null>(null);

  protected async setOpenToCommissions(open: boolean): Promise<void> {
    this.savingCommissions.set(true);
    this.commissionsError.set(null);
    const result = await this.api.user.updateProfile({
      openToCommissions: open,
    });
    if (result.ok) await this.session.refresh();
    else this.commissionsError.set(result.error.message);
    this.savingCommissions.set(false);
  }

  protected readonly designsResource = resource({
    loader: async () => unwrap(await this.api.designs.listMine()),
  });
  protected readonly designs = computed(() =>
    currentValue(this.designsResource),
  );

  protected readonly salesResource = resource({
    loader: async () => unwrap(await this.api.designs.listSales()),
  });
  protected readonly sales = computed(() => currentValue(this.salesResource));

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly price = designPriceLabel;
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  private readonly draft = signal({ name: '', description: '' });
  protected readonly newForm = form(this.draft, (path) => {
    required(path.name, { message: 'Give it a name.' });
  });

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.createError.set(null);
    await submit(this.newForm, async () => {
      const { name, description } = this.draft();
      const result = await this.api.designs.create({
        name: name.trim(),
        description: description.trim() || null,
      });
      if (!result.ok) {
        this.createError.set(result.error.message);
        return undefined;
      }
      await this.router.navigate(['/studio/designs', result.data.id]);
      return undefined;
    });
  }
}
