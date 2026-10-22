import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyPipe } from '@ime/ui';

/** The album on the receipt, in cents. */
const ALBUM_PRICE = 1000;
/** Stripe's standard rate for a US card: a percentage plus a fixed fee. */
const CARD_PERCENT = 0.029;
const CARD_FIXED = 30;
/** Bandcamp's published average share for artists, as a percentage. */
const BANDCAMP_SHARE = 82;

const NOTES = [
  {
    title: 'Human-made, pledged',
    line: 'Artists pledge every release is theirs, not AI generated. Releases found otherwise come down.',
  },
  {
    title: 'No platform cut',
    line: 'Artists keep the entire payment minus Stripe’s processing fee. IME takes nothing.',
  },
  {
    title: 'Music as art',
    line: 'Artists commission designers and creative developers to build immersive pages for a release, the way records once had sleeves and liner notes.',
  },
  { title: 'Own what you buy', line: 'Stream it and download it forever.' },
  {
    title: 'Open source, open books',
    line: 'Read the code, see every bill, chip in if you like.',
  },
];

/** What IME never takes. On short screens the optional lines drop out. */
const NOT_TAKEN = [
  { label: 'Shareholders', optional: false },
  { label: 'Executive bonuses', optional: true },
  { label: 'Ad networks', optional: false },
  { label: 'AI training data', optional: true },
  { label: 'A platform cut', optional: false },
];

/**
 * Every panel's box. Below the desktop layout, each panel is as tall as the
 * screen between the header and the bottom nav, so the whole sleeve is in
 * view; on the desktop, the grid stretches all three to the tallest, and on
 * wide screens they are square like a record sleeve.
 */
const PANEL =
  'flex w-[min(86%,26rem)] shrink-0 snap-center flex-col justify-between gap-5 overflow-y-auto p-6 [scrollbar-width:none] h-[calc(100svh-8.5rem)] max-h-[38rem] short:gap-3 short:p-4 lg:order-none lg:h-auto lg:max-h-none lg:min-h-[30rem] lg:w-auto lg:overflow-visible lg:p-7 xl:aspect-square xl:min-h-0';

/**
 * The top of the home page: an opened gatefold sleeve. The front says what
 * IME is and splits listeners from artists; the inside left is a receipt
 * for a $10 album; the inside right is IME's commitments as liner notes.
 * On a phone the panels sit side by side and swipe, front first.
 */
@Component({
  selector: 'ime-gatefold-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, RouterLink],
  host: { class: 'block bg-ink text-canvas' },
  // On wide screens the sleeve scales like print: every size is a share of
  // the panel, set so the defaults are right for a 467 px square.
  styles: `
    @media (width >= 80rem) {
      section {
        container-type: inline-size;
      }
      .sleeve {
        --u: calc(100cqw * 16 / 1400);
        --spacing: calc(var(--u) / 4);
        --text-xs: calc(var(--u) * 0.75);
        --text-sm: calc(var(--u) * 0.875);
        --text-base: var(--u);
        --text-lg: calc(var(--u) * 1.125);
        font-size: var(--u);
      }
    }
  `,
  template: `
    <section
      aria-label="What IME is"
      class="mx-auto max-w-[1504px] px-4 py-3 md:px-8 md:py-4 lg:py-14"
    >
      <div
        class="sleeve -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-8 md:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0 lg:perspective-[2200px]"
      >
        <div
          [class]="panel"
          class="order-2 bg-canvas text-ink lg:origin-right lg:rotate-y-[14deg] lg:shadow-[-18px_22px_40px_rgba(0,0,0,0.45)]"
        >
          <div class="my-auto flex flex-col gap-2.5 short:gap-1.5 lg:my-0">
            <span
              class="border-b border-dashed border-ink pb-2 font-mono text-xs tracking-wide uppercase short:pb-1 short:text-[10px]"
              >Receipt · you buy a {{ price | money: 'usd' }} album</span
            >
            <dl
              class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 font-mono text-sm short:gap-y-0.5 short:text-[12px]"
            >
              <dt class="font-semibold">You pay</dt>
              <dd class="font-semibold">{{ price | money: 'usd' }}</dd>
              @for (line of notTaken; track line.label) {
                <dt
                  class="text-ink-muted line-through"
                  [class]="line.optional ? 'short:hidden' : ''"
                >
                  {{ line.label }}
                </dt>
                <dd
                  class="text-ink-muted"
                  [class]="line.optional ? 'short:hidden' : ''"
                >
                  {{ 0 | money: 'usd' }}
                </dd>
              }
              <dt class="border-t border-dashed border-ink pt-2 short:pt-1">
                Stripe's processing fee
              </dt>
              <dd class="border-t border-dashed border-ink pt-2 short:pt-1">
                {{ fee | money: 'usd' }}
              </dd>
              <dt class="text-base font-bold">The artist</dt>
              <dd class="bg-marker px-1 text-base font-bold">
                {{ artist | money: 'usd' }}
              </dd>
            </dl>
            <p
              class="font-mono text-xs leading-relaxed short:text-[11px] short:leading-snug"
            >
              The artist keeps {{ share }}% here, more on bigger orders. On
              <a
                class="link"
                href="https://bandcamp.com/artists"
                target="_blank"
                rel="noopener"
                >Bandcamp</a
              >, artists keep {{ bandcamp }}% of sales on average.
            </p>
          </div>
          <p class="text-sm leading-relaxed short:text-xs short:leading-snug">
            IME isn't built to profit. Sellers split IME's monthly hosting bill,
            usually a few cents each, and
            <a class="link" routerLink="/costs">the books are public</a>.
          </p>
        </div>

        <div
          [class]="panel"
          class="relative z-10 order-1 bg-accent text-white lg:p-9"
        >
          <h1
            class="my-auto text-[clamp(2.25rem,11vw,3.25rem)] leading-[0.88] font-black tracking-[-0.06em] short:text-[2.25rem] lg:my-0 lg:text-[3.25rem] xl:text-[calc(var(--u)*3.75)]"
          >
            Music is not a growth market.
          </h1>
          <div class="flex flex-col gap-4 short:gap-2.5">
            <p class="leading-snug short:text-sm xl:text-lg">
              Run by its community, for the people who make music: no cut, no
              shareholders, no AI, and no algorithm deciding who gets heard.
            </p>
            <div class="flex flex-wrap items-center gap-2.5 short:gap-2">
              <a
                href="#shelves"
                class="rounded-control bg-marker px-4 py-3 font-bold text-ink hover:bg-white short:px-3 short:py-2 short:text-sm"
                >Start listening</a
              >
              <a
                routerLink="/studio"
                class="rounded-control border border-white px-4 py-[11px] font-bold text-white hover:bg-white hover:text-accent short:px-3 short:py-[7px] short:text-sm"
                >Sell your music</a
              >
            </div>
            <span class="font-mono text-[11px] lg:hidden">swipe to open →</span>
          </div>
        </div>

        <div
          [class]="panel"
          class="order-3 bg-canvas text-ink lg:origin-left lg:-rotate-y-[14deg] lg:shadow-[18px_22px_40px_rgba(0,0,0,0.45)]"
        >
          <ol class="my-auto flex flex-col gap-2.5 short:gap-1.5 lg:my-0">
            @for (note of notes; track note.title; let i = $index) {
              <li class="grid grid-cols-[calc(var(--spacing)*7)_1fr] gap-2">
                <span class="pt-0.5 font-mono text-sm text-ink-muted">{{
                  number(i)
                }}</span>
                <span class="flex flex-col">
                  <span class="font-extrabold">{{ note.title }}</span>
                  <span
                    class="text-[13px] leading-snug text-ink-muted short:hidden xl:text-[calc(var(--u)*0.8125)]"
                    >{{ note.line }}</span
                  >
                </span>
              </li>
            }
          </ol>
          <p
            class="border-t border-hairline pt-2.5 font-mono text-xs leading-relaxed short:pt-1.5"
          >
            Credits: built by
            <a
              class="link"
              href="https://alecgreene.com"
              target="_blank"
              rel="noopener"
              >Alec Greene</a
            >
            and
            <a
              class="link"
              href="https://github.com/acgreene/internet-music-exchange"
              target="_blank"
              rel="noopener"
              >whoever wants to help</a
            >.
          </p>
        </div>
      </div>
    </section>
  `,
})
export class GatefoldHero {
  protected readonly price = ALBUM_PRICE;
  protected readonly fee = Math.round(ALBUM_PRICE * CARD_PERCENT + CARD_FIXED);
  protected readonly artist = ALBUM_PRICE - this.fee;
  protected readonly share = Math.floor((this.artist / ALBUM_PRICE) * 100);
  protected readonly bandcamp = BANDCAMP_SHARE;
  protected readonly notes = NOTES;
  protected readonly notTaken = NOT_TAKEN;
  protected readonly panel = PANEL;

  protected number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
}
