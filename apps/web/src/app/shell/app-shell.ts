import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CartService, ImmersiveMode, SessionService } from '@ime/client-data';
import { PlayerBar, SearchBox } from '@ime/client-listening';
import { ButtonDirective, WordmarkComponent } from '@ime/ui';
import { filter } from 'rxjs';

/**
 * The frame around every listening page: the header with the wordmark,
 * search, navigation, a way in for artists, cart and account menu, and the
 * player at the bottom. Below the desktop layout the links move into a menu,
 * so on a phone the site still feels like a website.
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
    PlayerBar,
    SearchBox,
    WordmarkComponent,
  ],
  host: {
    '(document:keydown)': 'focusSearch($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected readonly session = inject(SessionService);
  protected readonly cart = inject(CartService);
  protected readonly immersive = inject(ImmersiveMode);
  private readonly router = inject(Router);

  private readonly searchBox = viewChild(SearchBox);

  constructor() {
    // following a link from the menu closes it
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected readonly navigation = computed(() => [
    { label: 'Discover', path: '/' },
    { label: 'Crates', path: '/crates' },
    { label: 'Charts', path: '/charts' },
    { label: 'Designs', path: '/designs' },
    ...(this.session.isSignedIn()
      ? [
          { label: 'Library', path: '/library' },
          { label: 'Following', path: '/following' },
        ]
      : []),
  ]);

  /** The menu below the desktop layout, which holds the main links. */
  protected readonly menuOpen = signal(false);

  protected readonly initial = computed(() =>
    (this.session.user()?.username ?? '?').charAt(0),
  );

  protected readonly cartLabel = computed(() => {
    const count = this.cart.count();
    return count ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart';
  });

  /** `/` jumps to search from anywhere but a field being typed in. */
  protected focusSearch(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const typing =
      target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    if (event.key !== '/' || typing || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    this.searchBox()?.focus();
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigateByUrl('/');
  }
}
