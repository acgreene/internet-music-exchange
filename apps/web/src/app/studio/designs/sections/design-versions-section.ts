import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { ApiClient } from '@ime/api-client';
import { uploadFile } from '@ime/client-data';
import type { DesignSlot, ManagedDesignResponse } from '@ime/models';
import { AlertComponent, ButtonDirective, InputDirective } from '@ime/ui';

/**
 * The design's versions and how many releases use each, and uploading a new
 * one: a single HTML file and the slots it reads from the artist.
 */
@Component({
  selector: 'ime-design-versions-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, DatePipe, InputDirective],
  template: `
    <section class="flex flex-col gap-4" aria-labelledby="versions-heading">
      <div>
        <h2 id="versions-heading" class="text-lg font-semibold">Versions</h2>
        <p class="text-sm text-ink-muted">
          Releases keep the version they were set up with until their artist
          updates. Every license covers every version.
        </p>
      </div>

      <ul
        class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
      >
        @for (version of versions(); track version.id) {
          <li
            class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4 text-sm"
          >
            <span class="flex flex-col">
              <span class="font-mono font-semibold"
                >v{{ version.version }}</span
              >
              <span class="text-ink-muted">
                {{ version.createdAt | date: 'mediumDate' }},
                {{ kilobytes(version.byteSize) }} KB,
                {{ version.slots.length }}
                {{ version.slots.length === 1 ? 'slot' : 'slots' }}
              </span>
            </span>
            <span class="text-ink-muted">{{ releasesUsing(version.id) }}</span>
          </li>
        } @empty {
          <li class="p-4 text-sm text-ink-muted">
            No versions yet. Upload one to publish.
          </li>
        }
      </ul>

      <div
        class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
      >
        <h3 class="font-semibold">Upload version {{ nextVersion() }}</h3>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          HTML file
          <input
            #fileInput
            type="file"
            accept="text/html,.html"
            class="text-sm"
            (change)="file.set(picked($event))"
          />
          <span class="font-normal text-ink-muted">
            One self-contained file. It is shown sandboxed, with the release and
            the artist's slot values as its only data.
          </span>
        </label>

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1.5 text-sm font-medium">Slots</legend>
          @for (slot of slots(); track $index; let i = $index) {
            <div
              class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_7rem_auto]"
            >
              <input
                imeInput
                class="font-mono"
                aria-label="Slot name"
                placeholder="name"
                [value]="slot.name"
                (input)="setSlot(i, { name: text($event) })"
              />
              <input
                imeInput
                aria-label="Label"
                placeholder="What the artist sees"
                [value]="slot.label"
                (input)="setSlot(i, { label: text($event) })"
              />
              <select
                imeInput
                aria-label="Kind"
                (change)="setSlot(i, { kind: kind($event) })"
              >
                <option value="text" [selected]="slot.kind === 'text'">
                  Text
                </option>
                <option value="image" [selected]="slot.kind === 'image'">
                  Image
                </option>
              </select>
              <button
                imeButton
                variant="ghost"
                size="sm"
                type="button"
                (click)="removeSlot(i)"
              >
                Remove
              </button>
            </div>
          } @empty {
            <p class="text-sm text-ink-muted">
              No slots: the page works from the release alone.
            </p>
          }
          <div>
            <button
              imeButton
              variant="secondary"
              size="sm"
              type="button"
              (click)="addSlot()"
            >
              Add a slot
            </button>
          </div>
        </fieldset>

        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        @if (uploaded(); as version) {
          <ime-alert tone="success">Version {{ version }} is up.</ime-alert>
        }
        <div>
          <button
            imeButton
            [disabled]="!file()"
            [busy]="uploading()"
            (click)="upload(fileInput)"
          >
            Upload version
          </button>
        </div>
      </div>
    </section>
  `,
})
export class DesignVersionsSection {
  private readonly api = inject(ApiClient);

  public readonly managed = input.required<ManagedDesignResponse>();
  public readonly changed = output<void>();

  protected readonly versions = computed(() =>
    [...this.managed().versions].sort((a, b) => b.version - a.version),
  );
  protected readonly nextVersion = computed(
    () => (this.versions()[0]?.version ?? 0) + 1,
  );

  /** The new version's slots, starting from the latest version's. */
  protected readonly slots = linkedSignal<DesignSlot[]>(
    () => this.versions()[0]?.slots ?? [],
  );
  protected readonly file = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploaded = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected kind(event: Event): DesignSlot['kind'] {
    return (event.target as HTMLSelectElement).value as DesignSlot['kind'];
  }

  protected picked(event: Event): File | null {
    return (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected kilobytes(bytes: number): string {
    return (bytes / 1024).toFixed(1);
  }

  protected releasesUsing(versionId: string): string {
    const count =
      this.managed().usage.find((use) => use.designVersionId === versionId)
        ?.releases ?? 0;
    return count === 1 ? '1 release' : `${count} releases`;
  }

  protected setSlot(index: number, change: Partial<DesignSlot>): void {
    this.slots.update((slots) =>
      slots.map((slot, i) => (i === index ? { ...slot, ...change } : slot)),
    );
  }

  protected addSlot(): void {
    this.slots.update((slots) => [
      ...slots,
      { name: '', label: '', kind: 'text' },
    ]);
  }

  protected removeSlot(index: number): void {
    this.slots.update((slots) => slots.filter((_, i) => i !== index));
  }

  protected async upload(fileInput: HTMLInputElement): Promise<void> {
    const file = this.file();
    if (!file) return;
    const slots = this.slots().map((slot) => ({
      ...slot,
      name: slot.name.trim(),
      label: slot.label.trim(),
    }));
    const names = slots.map((slot) => slot.name);
    if (slots.some((slot) => !slot.name || !slot.label)) {
      this.error.set('Every slot needs a name and a label.');
      return;
    }
    if (new Set(names).size !== names.length) {
      this.error.set('Slot names must be different from each other.');
      return;
    }
    this.uploading.set(true);
    this.uploaded.set(null);
    this.error.set(null);
    const designId = this.managed().design.id;
    const target = await this.api.designs.createVersionUpload(designId);
    if (!target.ok) return this.fail(target.error.message);
    try {
      // the file picker may not label .html files, and the target expects HTML
      await uploadFile(
        target.data.uploadUrl,
        new File([file], file.name, { type: 'text/html' }),
      );
    } catch (error) {
      return this.fail(
        error instanceof Error ? error.message : 'The upload failed.',
      );
    }
    const version = await this.api.designs.confirmVersion(designId, {
      objectKey: target.data.objectKey,
      slots,
    });
    if (!version.ok) return this.fail(version.error.message);
    this.uploading.set(false);
    this.uploaded.set(version.data.version);
    this.file.set(null);
    fileInput.value = '';
    this.changed.emit();
  }

  private fail(message: string): void {
    this.uploading.set(false);
    this.error.set(message);
  }
}
