import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CrateCard as Crate } from '@ime/models';

/**
 * A crate in a list: the covers of its first four records, its name, who
 * made it, and how many records it holds.
 */
@Component({
  selector: 'ime-crate-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a class="group flex flex-col gap-2" [routerLink]="['/crates', crate().id]">
      <span
        class="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 border border-line bg-line"
        aria-hidden="true"
      >
        @for (cover of mosaic(); track $index) {
          @if (cover) {
            <img
              class="size-full object-cover"
              [src]="cover"
              alt=""
              loading="lazy"
            />
          } @else {
            <span class="bg-wash"></span>
          }
        }
      </span>
      <span class="flex flex-col">
        <span class="truncate font-bold group-hover:underline">{{
          crate().name
        }}</span>
        <span class="truncate text-sm text-ink-muted">
          @if (byLine() && crate().makerUsername) {
            &#64;{{ crate().makerUsername }} ·
          }
          {{ crate().itemCount }}
          {{ crate().itemCount === 1 ? 'record' : 'records' }}
          @if (crate().visibility === 'private') {
            · private
          }
        </span>
      </span>
    </a>
  `,
})
export class CrateCard {
  public readonly crate = input.required<Crate>();
  /** Show who made it, as lists of other people's crates do. */
  public readonly byLine = input(true);

  protected readonly mosaic = computed(() =>
    [0, 1, 2, 3].map((i) => this.crate().coverUrls[i] ?? null),
  );
}
