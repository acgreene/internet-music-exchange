import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CoverComponent } from '@ime/ui';

/**
 * A crate's face: the covers of its first four records in a square, with
 * plain tiles where it holds fewer.
 */
@Component({
  selector: 'ime-crate-mosaic',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent],
  host: {
    class:
      'grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 border border-line bg-line',
    'aria-hidden': 'true',
  },
  template: `
    @for (cover of covers(); track $index) {
      <ime-cover class="size-full" [src]="cover" alt="" />
    }
  `,
})
export class CrateMosaic {
  public readonly coverUrls = input.required<string[]>();

  protected readonly covers = computed(() =>
    [0, 1, 2, 3].map((i) => this.coverUrls()[i] ?? null),
  );
}
