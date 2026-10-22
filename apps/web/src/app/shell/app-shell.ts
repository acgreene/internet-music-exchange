import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { SessionService } from '@ime/client-data';
import { PlayerBar } from '@ime/client-listening';
import { ButtonDirective, InputDirective } from '@ime/ui';

/**
 * The frame around every listening page: the top bar with search and the
 * account menu, the navigation, and the player bar at the bottom.
 */
@Component({
  selector: 'ime-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    ButtonDirective,
    InputDirective,
    PlayerBar,
  ],
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly navigation = computed(() => [
    { label: 'Home', path: '/' },
    { label: 'Search', path: '/search' },
    ...(this.session.isSignedIn()
      ? [{ label: 'Following', path: '/following' }]
      : []),
  ]);

  protected async search(event: Event, query: string): Promise<void> {
    event.preventDefault();
    const q = query.trim();
    if (q) await this.router.navigate(['/search'], { queryParams: { q } });
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigateByUrl('/');
  }
}
