import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CrateItem } from '@ime/models';
import { ButtonDirective, CoverComponent } from '@ime/ui';
import { releasePriceLabel } from '../releases/release-labels';

/**
 * The records in a crate, in its order, each with the maker's line about
 * it. Its maker can reorder them, take them out, and change the lines.
 */
@Component({
  selector: 'ime-crate-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, CoverComponent, RouterLink],
  template: `
    <ol class="flex flex-col divide-y divide-hairline border-y border-line">
      @for (
        item of items();
        track item.release.id;
        let i = $index;
        let first = $first;
        let last = $last
      ) {
        <li
          class="grid grid-cols-[2rem_4.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 py-4 sm:grid-cols-[2rem_5.5rem_minmax(0,1fr)_auto]"
          [class.opacity-50]="!item.available"
        >
          <span class="pt-1 text-right font-mono text-sm text-ink-muted">{{
            i + 1
          }}</span>
          <a
            [routerLink]="[
              '/artists',
              item.release.artistHandle,
              item.release.slug,
            ]"
            [attr.aria-label]="item.release.title"
          >
            <ime-cover
              class="w-full border border-line"
              [src]="item.release.coverUrl"
              alt=""
            />
          </a>
          <div class="flex min-w-0 flex-col gap-1">
            <a
              class="truncate font-bold hover:underline"
              [routerLink]="[
                '/artists',
                item.release.artistHandle,
                item.release.slug,
              ]"
              >{{ item.release.title }}</a
            >
            <a
              class="-mt-1 truncate text-sm text-ink-muted hover:underline"
              [routerLink]="['/artists', item.release.artistHandle]"
              >{{ item.release.artistName }}</a
            >
            <span class="font-mono text-xs">{{
              item.available ? price(item) : 'No longer on IME'
            }}</span>
            @if (editable()) {
              <input
                class="mt-1 w-full max-w-prose rounded-control border border-line bg-canvas px-2 py-1 text-sm"
                maxlength="280"
                placeholder="Why it's here (optional)"
                [attr.aria-label]="'Why ' + item.release.title + ' is here'"
                [value]="item.note ?? ''"
                (change)="
                  noteChange.emit({
                    releaseId: item.release.id,
                    note: $any($event.target).value,
                  })
                "
              />
            } @else if (item.note) {
              <p class="mt-1 max-w-prose text-sm italic">“{{ item.note }}”</p>
            }
          </div>
          @if (editable()) {
            <div
              class="col-span-3 col-start-2 flex gap-1 sm:col-span-1 sm:col-start-auto sm:items-start"
            >
              <button
                imeButton
                variant="ghost"
                size="sm"
                [disabled]="first"
                [attr.aria-label]="'Move ' + item.release.title + ' up'"
                (click)="move.emit({ index: i, by: -1 })"
              >
                ↑
              </button>
              <button
                imeButton
                variant="ghost"
                size="sm"
                [disabled]="last"
                [attr.aria-label]="'Move ' + item.release.title + ' down'"
                (click)="move.emit({ index: i, by: 1 })"
              >
                ↓
              </button>
              <button
                imeButton
                variant="ghost"
                size="sm"
                (click)="remove.emit(item.release.id)"
              >
                Take out
              </button>
            </div>
          }
        </li>
      } @empty {
        <li class="py-6 text-sm text-ink-muted">{{ emptyText() }}</li>
      }
    </ol>
  `,
})
export class CrateList {
  public readonly items = input.required<CrateItem[]>();
  public readonly editable = input(false);
  public readonly emptyText = input('Nothing in this crate yet.');

  public readonly move = output<{ index: number; by: -1 | 1 }>();
  public readonly remove = output<string>();
  public readonly noteChange = output<{ releaseId: string; note: string }>();

  protected price(item: CrateItem): string {
    return releasePriceLabel(item.pricing);
  }
}
