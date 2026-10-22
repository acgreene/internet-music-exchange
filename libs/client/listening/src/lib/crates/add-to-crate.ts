import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import type { MyCrate } from '@ime/models';
import { ButtonDirective, SpinnerComponent } from '@ime/ui';

/**
 * Put a release into one of your crates, or a new one, from its page.
 */
@Component({
  selector: 'ime-add-to-crate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, RouterLink, SpinnerComponent],
  host: {
    class: 'relative block',
    '(document:keydown.escape)': 'open.set(false)',
    '(document:click)': 'closeOutside($event)',
  },
  template: `
    @if (session.isSignedIn()) {
      <button
        imeButton
        variant="secondary"
        size="sm"
        aria-haspopup="true"
        [attr.aria-expanded]="open()"
        (click)="toggle()"
      >
        Add to crate
      </button>
      @if (open()) {
        <div
          class="absolute left-0 z-20 mt-1.5 flex w-72 flex-col gap-1 rounded-card border border-line bg-surface p-2 shadow-lg"
          role="dialog"
          aria-label="Add to a crate"
        >
          @if (crates(); as crates) {
            @for (crate of crates; track crate.id) {
              <button
                class="flex items-center justify-between gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-wash"
                [attr.aria-pressed]="crate.holdsRelease"
                [disabled]="busy()"
                (click)="flip(crate)"
              >
                <span class="truncate">{{ crate.name }}</span>
                <span class="shrink-0 font-mono text-xs text-ink-muted">{{
                  crate.holdsRelease ? '✓ in it' : crate.itemCount
                }}</span>
              </button>
            } @empty {
              <p class="px-2 py-1 text-sm text-ink-muted">No crates yet.</p>
            }
          } @else {
            <ime-spinner />
          }
          <form
            class="mt-1 flex gap-1 border-t border-hairline pt-2"
            (submit)="createWith($event)"
          >
            <input
              class="min-w-0 flex-1 rounded-control border border-line bg-canvas px-2 py-1 text-sm"
              maxlength="80"
              aria-label="New crate name"
              placeholder="New crate"
              [value]="newName()"
              (input)="newName.set($any($event.target).value)"
            />
            <button
              imeButton
              size="sm"
              type="submit"
              [disabled]="!newName().trim() || busy()"
            >
              Add
            </button>
          </form>
          @if (error(); as error) {
            <p class="px-2 text-sm text-danger">{{ error }}</p>
          }
          @if (made(); as made) {
            <a class="link px-2 text-sm" [routerLink]="['/crates', made]"
              >Open the new crate</a
            >
          }
        </div>
      }
    } @else {
      <a
        imeButton
        variant="secondary"
        size="sm"
        routerLink="/sign-in"
        [queryParams]="{ returnUrl: router.url }"
        >Add to crate</a
      >
    }
  `,
})
export class AddToCrate {
  private readonly api = inject(ApiClient);
  protected readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  public readonly releaseId = input.required<string>();

  protected readonly open = signal(false);
  protected readonly crates = signal<MyCrate[] | null>(null);
  protected readonly newName = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly made = signal<string | null>(null);

  private readonly host = inject(ElementRef<HTMLElement>);

  protected closeOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected async toggle(): Promise<void> {
    this.open.set(!this.open());
    if (!this.open()) return;
    this.crates.set(null);
    this.made.set(null);
    const result = await this.api.crates.listMine(this.releaseId());
    this.crates.set(result.ok ? result.data : []);
    if (!result.ok) this.error.set(result.error.message);
  }

  /** Add the release to a crate, or take it out of one that holds it. */
  protected async flip(crate: MyCrate): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const result = crate.holdsRelease
      ? await this.api.crates.removeRelease(crate.id, this.releaseId())
      : await this.api.crates.addRelease(crate.id, this.releaseId());
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.error.message);
      return;
    }
    const holds = !crate.holdsRelease;
    this.crates.update((crates) =>
      (crates ?? []).map((c) =>
        c.id === crate.id
          ? {
              ...c,
              holdsRelease: holds,
              itemCount: c.itemCount + (holds ? 1 : -1),
            }
          : c,
      ),
    );
  }

  protected async createWith(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    const result = await this.api.crates.create({
      name: this.newName(),
      visibility: 'public',
      releaseIds: [this.releaseId()],
    });
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.error.message);
      return;
    }
    this.newName.set('');
    this.made.set(result.data.id);
    this.crates.update((crates) => [
      { ...result.data, holdsRelease: true },
      ...(crates ?? []),
    ]);
  }
}
