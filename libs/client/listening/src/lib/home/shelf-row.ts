import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Shelf } from '@ime/models';
import { CoverComponent, MoneyPipe } from '@ime/ui';
import { productTypeLabel } from '../merch/merch-labels';
import { releasePriceLabel } from '../releases/release-labels';

/** A press that moves further than this is a drag, not a click. */
const DRAG_PX = 6;

/**
 * One home page shelf: a titled row of records or merch that scrolls
 * sideways, with the reason it is there. Swipe it on a phone; on a computer,
 * drag it with the mouse or page through it with the arrow buttons.
 */
@Component({
  selector: 'ime-shelf-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent, MoneyPipe, RouterLink],
  template: `
    <section class="flex flex-col gap-3" [attr.aria-labelledby]="headingId()">
      <div class="flex items-end justify-between gap-4">
        <h2
          [id]="headingId()"
          class="text-2xl font-extrabold tracking-[-0.035em]"
        >
          @if (link(); as link) {
            <a class="hover:underline" [routerLink]="link">{{
              shelf().title
            }}</a>
          } @else {
            {{ shelf().title }}
          }
          @if (shelf().reason) {
            <span
              class="ml-1 text-base font-medium tracking-normal text-ink-muted"
              >{{ shelf().reason }}</span
            >
          }
        </h2>
        <div class="flex shrink-0 items-center gap-1">
          @if (link(); as link) {
            <a class="link mr-2 text-sm" [routerLink]="link">See all</a>
          }
          <button
            class="hidden size-9 items-center justify-center rounded-full border border-line hover:border-ink hover:bg-wash disabled:opacity-30 disabled:hover:border-line disabled:hover:bg-transparent md:flex"
            [attr.aria-label]="'Earlier in ' + shelf().title"
            [disabled]="atStart()"
            (click)="page(-1)"
          >
            ←
          </button>
          <button
            class="hidden size-9 items-center justify-center rounded-full border border-line hover:border-ink hover:bg-wash disabled:opacity-30 disabled:hover:border-line disabled:hover:bg-transparent md:flex"
            [attr.aria-label]="'Later in ' + shelf().title"
            [disabled]="atEnd()"
            (click)="page(1)"
          >
            →
          </button>
        </div>
      </div>
      <ul
        #track
        class="-mx-4 grid auto-cols-[minmax(9.5rem,11rem)] grid-flow-col gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:cursor-grab md:px-0"
        [class.snap-x]="!dragging()"
        [style.cursor]="dragging() ? 'grabbing' : null"
        (scroll)="measure()"
        (pointerdown)="dragStart($event)"
        (pointermove)="dragMove($event)"
        (pointerup)="dragEnd()"
        (pointercancel)="dragEnd()"
      >
        @for (item of shelf().items; track $index) {
          <li class="snap-start">
            @if (item.kind === 'release') {
              <a
                class="group flex flex-col gap-1.5"
                draggable="false"
                [routerLink]="[
                  '/artists',
                  item.release.artistHandle,
                  item.release.slug,
                ]"
              >
                <ime-cover
                  class="pointer-events-none w-full border border-line"
                  [src]="item.release.coverUrl"
                  [alt]="'Cover of ' + item.release.title"
                />
                <span class="line-clamp-2 font-bold group-hover:underline">{{
                  item.release.title
                }}</span>
                <span class="-mt-1 line-clamp-2 text-sm text-ink-muted">{{
                  item.release.artistName
                }}</span>
                <span class="font-mono text-xs">{{
                  priceLabel(item.pricing)
                }}</span>
              </a>
            } @else {
              <a
                class="group flex flex-col gap-1.5"
                draggable="false"
                [routerLink]="['/artists', item.artistHandle, 'merch', item.id]"
              >
                <ime-cover
                  class="pointer-events-none w-full border border-line"
                  [src]="item.imageUrl"
                  [alt]="item.name"
                />
                <span class="line-clamp-2 font-bold group-hover:underline">{{
                  item.name
                }}</span>
                <span class="-mt-1 line-clamp-2 text-sm text-ink-muted">{{
                  item.artistName
                }}</span>
                <span class="font-mono text-xs"
                  >{{ typeLabel(item.productType) }},
                  {{ item.price | money: item.currency }}</span
                >
              </a>
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class ShelfRow {
  private readonly router = inject(Router);

  public readonly shelf = input.required<Shelf>();

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  protected readonly typeLabel = productTypeLabel;
  protected readonly priceLabel = releasePriceLabel;

  /** Where the shelf leads, read whole so a query in it survives. */
  protected readonly link = computed(() => {
    const link = this.shelf().link;
    return link ? this.router.parseUrl(link) : null;
  });

  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);
  protected readonly dragging = signal(false);

  private press: { x: number; scroll: number; moved: boolean } | null = null;
  /** A drag just ended, so the click it fires must not open a record. */
  private dragged = false;

  constructor() {
    afterNextRender(() => {
      this.measure();
      // a drag ends in a click; caught before it reaches a link, so the
      // record under the mouse does not open
      this.track()?.nativeElement.addEventListener(
        'click',
        (event) => this.swallowClick(event),
        { capture: true },
      );
    });
  }

  protected headingId(): string {
    return `shelf-${this.shelf().id}`;
  }

  protected measure(): void {
    const track = this.track()?.nativeElement;
    if (!track) return;
    this.atStart.set(track.scrollLeft <= 1);
    this.atEnd.set(
      track.scrollLeft + track.clientWidth >= track.scrollWidth - 1,
    );
  }

  /** Move by most of a screen's width, keeping a card of overlap. */
  protected page(direction: -1 | 1): void {
    const track = this.track()?.nativeElement;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth * 0.85,
      behavior: 'smooth',
    });
  }

  protected dragStart(event: PointerEvent): void {
    // touch scrolls natively; only a mouse needs dragging by hand
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const track = this.track()?.nativeElement;
    if (!track) return;
    this.press = { x: event.clientX, scroll: track.scrollLeft, moved: false };
  }

  protected dragMove(event: PointerEvent): void {
    const track = this.track()?.nativeElement;
    if (!this.press || !track) return;
    const dx = event.clientX - this.press.x;
    if (!this.press.moved && Math.abs(dx) < DRAG_PX) return;
    if (!this.press.moved) {
      this.press.moved = true;
      this.dragging.set(true);
      track.setPointerCapture(event.pointerId);
    }
    track.scrollLeft = this.press.scroll - dx;
  }

  protected dragEnd(): void {
    this.dragged = !!this.press?.moved;
    this.press = null;
    this.dragging.set(false);
  }

  private swallowClick(event: MouseEvent): void {
    if (!this.dragged) return;
    this.dragged = false;
    event.preventDefault();
    event.stopPropagation();
  }
}
