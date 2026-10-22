import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ApiClient } from '@ime/api-client';
import { FieldComponent, InputDirective } from '@ime/ui';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

export type HandleAvailability = 'unchanged' | 'available' | 'taken';

/**
 * An artist's handle, `/artists/<handle>`, checked against the others as it
 * is typed. When renaming, pass the artist so its own handle counts as free.
 */
@Component({
  selector: 'ime-handle-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldComponent, InputDirective],
  template: `
    <ime-field
      label="Handle"
      [hint]="hint()"
      [errors]="
        checked() === 'taken' ? [{ message: 'That handle is taken.' }] : []
      "
      [touched]="checked() === 'taken'"
    >
      <input
        imeInput
        autocomplete="off"
        spellcheck="false"
        [value]="handle()"
        (input)="onInput($event)"
      />
    </ime-field>
  `,
})
export class HandleField {
  private readonly api = inject(ApiClient);

  public readonly handle = model('');
  /** The artist being renamed, if any. */
  public readonly artistId = input<string>();
  /** The handle the artist has now, which needs no check. */
  public readonly current = input<string>();
  public readonly availability = output<HandleAvailability>();

  protected readonly checked = toSignal(
    toObservable(computed(() => this.handle().trim())).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(async (handle): Promise<HandleAvailability> => {
        if (!handle || handle === this.current()) return 'unchanged';
        const result = await this.api.artists.isHandleAvailable(
          handle,
          this.artistId(),
        );
        return result.ok && !result.data.available ? 'taken' : 'available';
      }),
    ),
    { initialValue: 'unchanged' as HandleAvailability },
  );

  protected readonly hint = computed(() => {
    const handle = this.handle().trim();
    if (!handle) return 'Made from the name if you leave it empty.';
    return this.checked() === 'available'
      ? `Available: /artists/${handle}`
      : `Your address: /artists/${handle}`;
  });

  constructor() {
    effect(() => this.availability.emit(this.checked()));
  }

  protected onInput(event: Event): void {
    this.handle.set((event.target as HTMLInputElement).value);
  }
}
