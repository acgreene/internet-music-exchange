import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { DESIGN_STYLES, MAX_DESIGN_STYLES } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { STATUS_LABELS } from '../releases/release-options';
import { DesignPricingSection } from './sections/design-pricing-section';
import { DesignVersionsSection } from './sections/design-versions-section';

/**
 * Everything about one of the designer's designs: details, price, versions,
 * whether it is on the marketplace, and granting it to an artist.
 */
@Component({
  selector: 'ime-design-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    DesignPricingSection,
    DesignVersionsSection,
    InputDirective,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (managed(); as managed) {
      <div class="flex max-w-4xl flex-col gap-8">
        <header class="flex flex-col gap-3">
          <a class="link text-sm" routerLink="/studio/designs"
            >← Your designs</a
          >
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
                {{ managed.design.name }}
              </h1>
              <span
                class="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium"
              >
                {{ statusLabels[managed.design.status] }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2">
              @switch (managed.design.status) {
                @case ('draft') {
                  <button
                    imeButton
                    variant="danger"
                    [busy]="working() === 'delete'"
                    (click)="remove()"
                  >
                    Delete draft
                  </button>
                  <button
                    imeButton
                    [busy]="working() === 'publish'"
                    (click)="publish()"
                  >
                    Publish
                  </button>
                }
                @case ('published') {
                  @if (managed.design.visibility === 'public') {
                    <a
                      imeButton
                      variant="secondary"
                      [routerLink]="['/studio/marketplace', managed.design.id]"
                      >View listing</a
                    >
                  }
                  <button
                    imeButton
                    variant="secondary"
                    [busy]="working() === 'archive'"
                    (click)="archive()"
                  >
                    Archive
                  </button>
                }
                @case ('archived') {
                  <button
                    imeButton
                    [busy]="working() === 'publish'"
                    (click)="publish()"
                  >
                    Publish again
                  </button>
                }
              }
            </div>
          </div>
          @if (managed.design.status === 'archived') {
            <ime-alert
              >Archived: off the marketplace. Artists who have it keep using
              it.</ime-alert
            >
          }
          @if (managed.design.status === 'taken_down') {
            <ime-alert tone="error">Taken down by IME's moderators.</ime-alert>
          }
          @if (managed.design.offSaleAt) {
            <ime-alert tone="error">
              Off sale since
              {{ managed.design.offSaleAt | date: 'mediumDate' }} while your
              hosting balance is unpaid.
              <a class="link" routerLink="/studio/billing">Settle it</a> to sell
              again.
            </ime-alert>
          }
          @if (confirmingDelete()) {
            <div
              class="flex flex-wrap items-center gap-3 rounded-card border border-danger/40 bg-danger/10 p-3 text-sm"
            >
              <span>Delete this draft and its versions for good?</span>
              <button
                imeButton
                variant="danger"
                size="sm"
                [busy]="working() === 'delete'"
                (click)="remove()"
              >
                Delete
              </button>
              <button
                imeButton
                variant="ghost"
                size="sm"
                (click)="confirmingDelete.set(false)"
              >
                Keep it
              </button>
            </div>
          }
          @if (error(); as message) {
            <ime-alert tone="error">{{ message }}</ime-alert>
          }
        </header>

        <section class="flex flex-col gap-4" aria-labelledby="details-heading">
          <h2 id="details-heading" class="text-lg font-semibold">Details</h2>
          <div
            class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
          >
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              Name
              <input
                imeInput
                [value]="name()"
                (input)="name.set(text($event))"
              />
            </label>
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              Description
              <textarea
                imeInput
                rows="3"
                [value]="description()"
                (input)="description.set(text($event))"
              ></textarea>
            </label>
            <fieldset class="flex flex-col gap-2">
              <legend class="mb-1.5 text-sm font-medium">
                Styles, up to {{ maxStyles }}
              </legend>
              <div class="flex flex-wrap gap-1.5">
                @for (style of allStyles; track style.id) {
                  <button
                    type="button"
                    class="rounded-full border px-3 py-1 text-sm"
                    [class]="
                      styles().includes(style.id)
                        ? 'border-ink bg-ink text-canvas'
                        : 'border-line hover:border-ink'
                    "
                    [attr.aria-pressed]="styles().includes(style.id)"
                    [disabled]="
                      !styles().includes(style.id) &&
                      styles().length >= maxStyles
                    "
                    (click)="toggleStyle(style.id)"
                  >
                    {{ style.name }}
                  </button>
                }
              </div>
            </fieldset>
            <fieldset class="flex flex-col gap-2">
              <legend class="mb-1.5 text-sm font-medium">
                Who can find it
              </legend>
              <label class="flex items-start gap-3">
                <input
                  type="radio"
                  name="visibility"
                  class="mt-1"
                  [checked]="visibility() === 'public'"
                  (change)="visibility.set('public')"
                />
                <span>Anyone, on the marketplace</span>
              </label>
              <label class="flex items-start gap-3">
                <input
                  type="radio"
                  name="visibility"
                  class="mt-1"
                  [checked]="visibility() === 'private'"
                  (change)="visibility.set('private')"
                />
                <span>Only artists you grant it to</span>
              </label>
            </fieldset>
            @if (detailsSaved()) {
              <ime-alert tone="success">Details saved.</ime-alert>
            }
            <div>
              <button
                imeButton
                variant="secondary"
                [busy]="working() === 'details'"
                (click)="saveDetails()"
              >
                Save details
              </button>
            </div>
          </div>
        </section>

        <ime-design-pricing-section
          [design]="managed.design"
          (changed)="designResource.reload()"
        />
        <ime-design-versions-section
          [managed]="managed"
          (changed)="designResource.reload()"
        />

        <section class="flex flex-col gap-4" aria-labelledby="grant-heading">
          <div>
            <h2 id="grant-heading" class="text-lg font-semibold">
              Grant to an artist
            </h2>
            <p class="text-sm text-ink-muted">
              Give an artist a license without payment, as when delivering a
              commission.
            </p>
          </div>
          <form
            class="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4"
            (submit)="grant($event)"
          >
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              Artist handle
              <span
                class="flex items-center gap-1 rounded-control border border-line bg-canvas px-3"
              >
                <span class="text-ink-muted">&#64;</span>
                <input
                  class="h-10 w-48 bg-transparent outline-none"
                  [value]="handle()"
                  (input)="handle.set(text($event))"
                />
              </span>
            </label>
            <button
              imeButton
              type="submit"
              variant="secondary"
              [busy]="working() === 'grant'"
            >
              Grant
            </button>
            @if (granted(); as granted) {
              <span class="text-sm text-success"
                >&#64;{{ granted }} has it now.</span
              >
            }
          </form>
        </section>
      </div>
    } @else if (designResource.error(); as error) {
      <ime-alert tone="error">{{ error.message }}</ime-alert>
    } @else {
      <ime-spinner />
    }
  `,
})
export class DesignEditorPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  public readonly designId = input.required<string>();

  protected readonly designResource = resource({
    params: () => this.designId(),
    loader: async ({ params }) => unwrap(await this.api.designs.get(params)),
  });
  protected readonly managed = computed(() =>
    currentValue(this.designResource),
  );

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly name = linkedSignal(
    () => this.managed()?.design.name ?? '',
  );
  protected readonly description = linkedSignal(
    () => this.managed()?.design.description ?? '',
  );
  protected readonly visibility = linkedSignal(
    () => this.managed()?.design.visibility ?? 'public',
  );
  protected readonly allStyles = DESIGN_STYLES;
  protected readonly maxStyles = MAX_DESIGN_STYLES;
  protected readonly styles = linkedSignal<string[]>(
    () => this.managed()?.design.styles ?? [],
  );
  protected readonly handle = signal('');

  protected readonly working = signal<
    'details' | 'publish' | 'archive' | 'delete' | 'grant' | null
  >(null);
  protected readonly confirmingDelete = signal(false);
  protected readonly detailsSaved = signal(false);
  protected readonly granted = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async saveDetails(): Promise<void> {
    this.detailsSaved.set(false);
    const done = await this.act('details', () =>
      this.api.designs.update(this.designId(), {
        name: this.name().trim(),
        description: this.description().trim() || null,
        visibility: this.visibility(),
        styles: this.styles(),
      }),
    );
    if (done) this.detailsSaved.set(true);
  }

  protected toggleStyle(id: string): void {
    this.styles.update((styles) =>
      styles.includes(id)
        ? styles.filter((style) => style !== id)
        : [...styles, id],
    );
  }

  protected async publish(): Promise<void> {
    await this.act('publish', () => this.api.designs.publish(this.designId()));
  }

  protected async archive(): Promise<void> {
    await this.act('archive', () => this.api.designs.archive(this.designId()));
  }

  protected async remove(): Promise<void> {
    if (!this.confirmingDelete()) {
      this.confirmingDelete.set(true);
      return;
    }
    const done = await this.act('delete', () =>
      this.api.designs.delete(this.designId()),
    );
    if (done) await this.router.navigate(['/studio/designs']);
  }

  protected async grant(event: Event): Promise<void> {
    event.preventDefault();
    const handle = this.handle().trim().replace(/^@/, '');
    if (!handle) return;
    this.granted.set(null);
    const done = await this.act('grant', () =>
      this.api.designs.grant(this.designId(), handle),
    );
    if (done) {
      this.granted.set(handle);
      this.handle.set('');
    }
  }

  private async act(
    kind: 'details' | 'publish' | 'archive' | 'delete' | 'grant',
    call: () => Promise<ApiResult<unknown>>,
  ): Promise<boolean> {
    this.working.set(kind);
    this.error.set(null);
    const result = await call();
    this.working.set(null);
    if (!result.ok) {
      this.error.set(result.error.message);
      return false;
    }
    if (kind !== 'delete' && kind !== 'grant') this.designResource.reload();
    return true;
  }
}
