import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '@ime/client-data';
import { ButtonDirective, WordmarkComponent } from '@ime/ui';

/**
 * The admin tools' frame: the moderation queue, recording claims, and the
 * monthly billing close.
 */
@Component({
  selector: 'ime-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonDirective,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    WordmarkComponent,
  ],
  template: `
    <div class="flex min-h-dvh flex-col">
      <header
        class="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2 md:px-6"
      >
        <a
          routerLink="/admin"
          class="flex items-end gap-2"
          aria-label="IME Admin"
        >
          <ime-wordmark [showName]="false" />
          <span class="pb-0.5 text-lg font-extrabold tracking-[-0.03em]"
            >admin</span
          >
        </a>
        <nav
          class="order-last flex w-full gap-1 sm:order-none sm:w-auto"
          aria-label="Admin"
        >
          @for (item of sections; track item.path) {
            <a
              class="rounded-control px-3 py-2 text-sm text-ink-muted hover:bg-wash hover:text-ink"
              routerLinkActive="bg-wash text-ink font-semibold"
              [routerLinkActiveOptions]="{ exact: true }"
              [routerLink]="item.path"
              >{{ item.label }}</a
            >
          }
        </nav>
        <div class="flex-1"></div>
        <a imeButton variant="ghost" size="sm" routerLink="/"
          >Back to listening</a
        >
        <span class="hidden text-sm text-ink-muted sm:inline">{{
          session.user()?.username
        }}</span>
      </header>
      <main class="min-w-0 flex-1 px-4 py-6 md:px-8">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShell {
  protected readonly session = inject(SessionService);

  protected readonly sections = [
    { label: 'Reports', path: '/admin' },
    { label: 'Copyright claim', path: '/admin/claims/new' },
    { label: 'Billing months', path: '/admin/billing' },
  ];
}
