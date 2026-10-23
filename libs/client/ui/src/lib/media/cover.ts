import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';

/**
 * Square cover art, or a plain tile while a release has none. Size it from
 * outside with a width class. A pulsing tile stands in while the art loads.
 */
@Component({
  selector: 'ime-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block aspect-square overflow-hidden bg-surface-muted data-loading:bg-hairline data-loading:motion-safe:animate-pulse',
    '[attr.data-loading]': 'loading() || null',
  },
  template: `
    @if (src(); as src) {
      <img
        #image
        class="size-full object-cover transition-opacity duration-200"
        loading="lazy"
        [class.opacity-0]="loading()"
        [src]="src"
        [alt]="alt()"
        (load)="loading.set(false)"
        (error)="loading.set(false)"
      />
    } @else {
      <div class="size-full" role="img" [attr.aria-label]="alt()"></div>
    }
  `,
})
export class CoverComponent {
  public readonly src = input<string | null>(null);
  public readonly alt = input('');

  private readonly image = viewChild<ElementRef<HTMLImageElement>>('image');

  /** Waiting on the art, again whenever it changes. */
  protected readonly loading = linkedSignal(() => !!this.src());

  constructor() {
    afterNextRender(() => {
      // art the server rendered may have loaded before the page could listen
      if (this.image()?.nativeElement.complete) this.loading.set(false);
    });
  }
}
