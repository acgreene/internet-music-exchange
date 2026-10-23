import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CrateCard as Crate } from '@ime/models';
import { CrateMosaic } from './crate-mosaic';

/**
 * A crate in a list: the covers of its first four records, its name, who
 * made it, and how many records it holds.
 */
@Component({
  selector: 'ime-crate-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrateMosaic, RouterLink],
  template: `
    <a class="group flex flex-col gap-2" [routerLink]="['/crates', crate().id]">
      <ime-crate-mosaic [coverUrls]="crate().coverUrls" />
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
}
