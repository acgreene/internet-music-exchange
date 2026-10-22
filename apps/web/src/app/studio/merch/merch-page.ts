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
import { currentValue } from '@ime/client-data';
import type { ProductType } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  FieldComponent,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { STATUS_LABELS } from '../releases/release-options';
import { StudioService } from '../studio.service';
import { PRODUCT_TYPES, typeLabel } from './merch-options';

/**
 * The artist's merch, and a quick way to start a product.
 */
@Component({
  selector: 'ime-merch-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    FieldComponent,
    FormField,
    InputDirective,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-4xl flex-col gap-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Merch</h1>
        <button
          imeButton
          [variant]="creating() ? 'secondary' : 'primary'"
          [disabled]="!canSell()"
          (click)="creating.set(!creating())"
        >
          {{ creating() ? 'Cancel' : 'New product' }}
        </button>
      </div>

      @if (canSell() === false) {
        <ime-alert>
          Merch is priced in your selling currency, which comes from your
          payment account.
          <a
            class="link"
            [routerLink]="[
              '/studio/artists',
              studio.currentArtistId(),
              'payments',
            ]"
            >Set up getting paid</a
          >
          to start selling merch.
        </ime-alert>
      }

      @if (creating()) {
        <form
          class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
          novalidate
          (submit)="create($event)"
        >
          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <ime-field
              label="Name"
              [errors]="newForm.name().errors()"
              [touched]="newForm.name().touched()"
            >
              <input imeInput [formField]="newForm.name" />
            </ime-field>
            <ime-field label="Type">
              <select imeInput [formField]="newForm.type">
                @for (type of types; track type.value) {
                  <option [value]="type.value">{{ type.label }}</option>
                }
              </select>
            </ime-field>
          </div>
          <ime-field
            label="Options"
            hint="What buyers choose between, comma separated, such as Size, Color. Up to three. Leave empty for none."
          >
            <input imeInput [formField]="newForm.options" />
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

      @if (products.error()) {
        <ime-alert tone="error">The merch could not be loaded.</ime-alert>
      } @else if (list(); as list) {
        <ul
          class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
        >
          @for (product of list; track product.id) {
            <li>
              <a
                class="flex items-center justify-between gap-4 p-4 hover:bg-wash"
                [routerLink]="['/studio/products', product.id]"
              >
                <span class="flex min-w-0 flex-col">
                  <span class="truncate font-medium">{{ product.name }}</span>
                  <span class="text-sm text-ink-muted">{{
                    label(product.type)
                  }}</span>
                </span>
                <span
                  class="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium"
                  >{{ statusLabels[product.status] }}</span
                >
              </a>
            </li>
          } @empty {
            <li class="p-4 text-ink-muted">
              No merch yet. Vinyl, tapes, shirts: start one with New product.
            </li>
          }
        </ul>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class MerchPage {
  private readonly api = inject(ApiClient);
  protected readonly studio = inject(StudioService);
  private readonly router = inject(Router);

  protected readonly types = PRODUCT_TYPES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly label = typeLabel;
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  private readonly account = resource({
    params: () => this.studio.currentArtistId() ?? undefined,
    loader: async ({ params }) =>
      unwrap(await this.api.funding.getArtistPaymentAccount(params)),
  });
  /** Whether merch can be made yet; unknown while the account loads. */
  protected readonly canSell = computed(() => {
    const account = currentValue(this.account);
    return account ? account.chargesEnabled : null;
  });

  protected readonly products = resource({
    params: () => this.studio.currentArtistId() ?? undefined,
    loader: async ({ params }) =>
      unwrap(await this.api.merch.listForArtist(params)),
  });
  protected readonly list = computed(() => currentValue(this.products));

  private readonly draft = signal({
    name: '',
    type: 'shirt' as ProductType,
    options: '',
  });
  protected readonly newForm = form(this.draft, (path) => {
    required(path.name, { message: 'Give it a name.' });
  });

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    const artistId = this.studio.currentArtistId();
    if (!artistId) return;
    this.createError.set(null);
    await submit(this.newForm, async () => {
      const { name, type, options } = this.draft();
      const result = await this.api.merch.create(artistId, {
        name: name.trim(),
        type,
        options: options
          .split(',')
          .map((option) => option.trim())
          .filter(Boolean),
      });
      if (!result.ok) {
        this.createError.set(result.error.message);
        return undefined;
      }
      await this.router.navigate(['/studio/products', result.data.id]);
      return undefined;
    });
  }
}
