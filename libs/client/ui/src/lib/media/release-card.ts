import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverComponent } from './cover';

/**
 * A release in a grid: its cover and title, linking to its page, with an
 * optional line beneath such as the artist or the year.
 */
@Component({
  selector: 'ime-release-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent, RouterLink],
  template: `
    <a class="group flex flex-col gap-2" [routerLink]="link()">
      <ime-cover
        class="w-full transition group-hover:opacity-90"
        [src]="coverUrl()"
        [alt]="'Cover of ' + title()"
      />
      <span class="truncate text-sm font-medium group-hover:underline">{{
        title()
      }}</span>
    </a>
    @if (subtitle(); as subtitle) {
      @if (subtitleLink(); as subtitleLink) {
        <a
          class="block truncate text-sm text-ink-muted hover:underline"
          [routerLink]="subtitleLink"
          >{{ subtitle }}</a
        >
      } @else {
        <span class="block truncate text-sm text-ink-muted">{{
          subtitle
        }}</span>
      }
    }
  `,
})
export class ReleaseCardComponent {
  public readonly title = input.required<string>();
  public readonly link = input.required<string | readonly unknown[]>();
  public readonly coverUrl = input<string | null>(null);
  public readonly subtitle = input<string | null>(null);
  public readonly subtitleLink = input<string | readonly unknown[] | null>(
    null,
  );
}
