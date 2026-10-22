import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { SessionService } from '@ime/client-data';
import { ButtonDirective } from '@ime/ui';

/**
 * The frame around every listening page: the top bar with the account menu,
 * the navigation, and the player bar's place at the bottom.
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
  ],
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly navigation = [{ label: 'Home', path: '/' }];

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigateByUrl('/');
  }
}
