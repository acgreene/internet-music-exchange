import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { designStyleName, type GalleryDesigner } from '@ime/models';

/**
 * A designer in the gallery: who they are, how much of their work is in
 * use, the styles they work in, a few of their designs, and whether they
 * take custom requests.
 */
@Component({
  selector: 'ime-designer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: {
    class: 'flex flex-col gap-3 rounded-card border border-line bg-surface p-4',
  },
  template: `
    <a
      class="group flex items-center gap-3"
      [routerLink]="['/users', designer().username]"
    >
      <span
        class="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-black text-canvas uppercase"
        aria-hidden="true"
        >{{ (designer().name || designer().username).charAt(0) }}</span
      >
      <span class="flex min-w-0 flex-col">
        <span class="truncate font-bold group-hover:underline">{{
          designer().name || '@' + designer().username
        }}</span>
        <span class="truncate text-sm text-ink-muted">{{ line() }}</span>
      </span>
    </a>
    @if (styles()) {
      <p class="truncate font-mono text-xs text-ink-muted">{{ styles() }}</p>
    }
    <ul class="flex flex-wrap gap-1.5" aria-label="Designs">
      @for (design of designer().designs; track design.id) {
        <li>
          <a
            class="block rounded-full border border-line px-2.5 py-0.5 text-sm hover:border-ink"
            [routerLink]="['/designs', design.id]"
            >{{ design.name }}</a
          >
        </li>
      }
    </ul>
    @if (designer().openToCommissions) {
      <p class="mt-auto text-sm font-medium text-accent">Takes requests</p>
    }
  `,
})
export class DesignerCard {
  public readonly designer = input.required<GalleryDesigner>();

  protected readonly line = computed(() => {
    const { username, designCount, releaseCount } = this.designer();
    const designs = `${designCount} ${designCount === 1 ? 'design' : 'designs'}`;
    return releaseCount
      ? `@${username}, ${designs} on ${releaseCount} ${releaseCount === 1 ? 'release' : 'releases'}`
      : `@${username}, ${designs}`;
  });

  protected readonly styles = computed(() =>
    this.designer().styles.slice(0, 4).map(designStyleName).join(', '),
  );
}
