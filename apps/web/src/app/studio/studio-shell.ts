import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '@ime/client-data';
import { ButtonDirective, WordmarkComponent } from '@ime/ui';
import { StudioService } from './studio.service';

/**
 * The studio's frame: the artist being worked on, with a switcher between
 * the artists the user manages, and that artist's sections.
 */
@Component({
  selector: 'ime-studio-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonDirective,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    WordmarkComponent,
  ],
  template: `
    <div class="flex min-h-dvh flex-col">
      <header
        class="flex h-16 items-center gap-4 border-b border-line bg-surface px-4 md:px-6"
      >
        <a
          routerLink="/studio"
          class="flex items-end gap-2"
          aria-label="IME Studio"
        >
          <ime-wordmark [showName]="false" />
          <span class="pb-0.5 text-lg font-extrabold tracking-[-0.03em]"
            >studio</span
          >
        </a>
        <div class="flex-1"></div>
        <a imeButton variant="ghost" size="sm" routerLink="/"
          >Back to listening</a
        >
        <span class="text-sm text-ink-muted">{{
          session.user()?.username
        }}</span>
      </header>

      <div class="flex flex-1 flex-wrap">
        <nav
          class="flex w-full flex-col gap-1 border-b border-line p-3 md:w-60 md:border-r md:border-b-0"
          aria-label="Studio"
        >
          <button
            class="flex items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2 text-left text-sm"
            [cdkMenuTriggerFor]="artistMenu"
            aria-label="Switch artist"
          >
            <span class="truncate font-medium">{{
              studio.currentArtist()?.name ?? 'Choose an artist'
            }}</span>
            <span aria-hidden="true">▾</span>
          </button>
          @if (studio.currentArtist(); as artist) {
            <div class="mt-3 flex flex-col gap-1">
              @for (item of sections(); track item.path) {
                <a
                  class="rounded-control px-3 py-2 text-sm text-ink-muted hover:bg-wash hover:text-ink"
                  routerLinkActive="bg-wash text-ink font-semibold"
                  [routerLinkActiveOptions]="{ exact: item.exact }"
                  [routerLink]="item.path"
                  >{{ item.label }}</a
                >
              }
              <a
                class="rounded-control px-3 py-2 text-sm text-ink-muted hover:bg-wash hover:text-ink"
                [routerLink]="['/artists', artist.handle]"
                >View public page</a
              >
            </div>
          }
          <div class="mt-3 flex flex-col gap-1 border-t border-line pt-3">
            @for (item of global; track item.path) {
              <a
                class="rounded-control px-3 py-2 text-sm text-ink-muted hover:bg-wash hover:text-ink"
                routerLinkActive="bg-wash text-ink font-semibold"
                [routerLink]="item.path"
                >{{ item.label }}</a
              >
            }
          </div>
        </nav>
        <main class="min-w-0 flex-[999_1_560px] px-4 py-6 md:px-8">
          <router-outlet />
        </main>
      </div>
    </div>

    <ng-template #artistMenu>
      <div
        cdkMenu
        class="min-w-56 rounded-card border border-line bg-surface p-1 shadow-lg"
      >
        @for (artist of studio.artistList(); track artist.id) {
          <a
            cdkMenuItem
            class="block rounded-control px-3 py-2 text-sm hover:bg-wash"
            [routerLink]="['/studio/artists', artist.id]"
            >{{ artist.name }}</a
          >
        }
        <a
          cdkMenuItem
          class="block rounded-control px-3 py-2 text-sm font-medium hover:bg-wash"
          routerLink="/studio/artists/new"
        >
          New artist
        </a>
      </div>
    </ng-template>
  `,
})
export class StudioShell {
  protected readonly studio = inject(StudioService);
  protected readonly session = inject(SessionService);

  /** Pages about the signed-in user rather than one artist. */
  protected readonly global = [
    { label: 'Hosting balance', path: '/studio/billing' },
  ];

  protected readonly sections = computed(() => {
    const base = `/studio/artists/${this.studio.currentArtist()?.id}`;
    return [
      { label: 'Releases', path: base, exact: true },
      { label: 'Merch', path: `${base}/merch`, exact: false },
      { label: 'Sales', path: `${base}/sales`, exact: false },
      { label: 'Getting paid', path: `${base}/payments`, exact: false },
      { label: 'Hosting costs', path: `${base}/costs`, exact: false },
      { label: 'Profile', path: `${base}/profile`, exact: false },
      { label: 'Managers', path: `${base}/managers`, exact: false },
      { label: 'Followers', path: `${base}/followers`, exact: false },
    ];
  });
}
