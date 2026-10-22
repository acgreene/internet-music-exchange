import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Square cover art, or a plain tile while a release has none. Size it from
 * outside with a width class.
 */
@Component({
  selector: 'ime-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block aspect-square overflow-hidden' },
  template: `
    @if (src(); as src) {
      <img
        class="size-full object-cover"
        loading="lazy"
        [src]="src"
        [alt]="alt()"
      />
    } @else {
      <div
        class="size-full bg-surface-muted"
        role="img"
        [attr.aria-label]="alt()"
      ></div>
    }
  `,
})
export class CoverComponent {
  public readonly src = input<string | null>(null);
  public readonly alt = input('');
}
