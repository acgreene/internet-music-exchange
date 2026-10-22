import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Three bars that bounce while something plays and rest while it is paused.
 */
@Component({
  selector: 'ime-equalizer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex h-3 items-end gap-0.5',
    'aria-hidden': 'true',
  },
  template: `
    @for (delay of delays; track delay) {
      <span
        class="h-full w-[3px] origin-bottom bg-current"
        [class.animate-equalizer]="playing()"
        [class.scale-y-50]="!playing()"
        [style.animation-delay]="delay"
      ></span>
    }
  `,
})
export class EqualizerComponent {
  public readonly playing = input(false);

  protected readonly delays = ['0s', '-0.3s', '-0.6s'];
}
