import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CartService, SessionService } from '@ime/client-data';
import { PlayerBar } from '@ime/client-listening';
import { ButtonDirective, WordmarkComponent } from '@ime/ui';

/**
 * The frame around every listening page: the header with the wordmark,
 * search, navigation, cart and account menu, and the player at the bottom.
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
    WordmarkComponent,
  ],
  host: { '(document:keydown)': 'focusSearch($event)' },
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected readonly session = inject(SessionService);
  protected readonly cart = inject(CartService);
  private readonly router = inject(Router);

  private readonly query = viewChild<ElementRef<HTMLInputElement>>('query');

  protected readonly navigation = computed(() => [
    { label: 'Discover', path: '/' },
    ...(this.session.isSignedIn()
      ? [
          { label: 'Library', path: '/library' },
          { label: 'Following', path: '/following' },
        ]
      : []),
  ]);

  /** Phones search from a tab, since the header has no room for the box. */
  protected readonly mobileNavigation = computed(() => [
    { label: 'Discover', path: '/' },
    { label: 'Search', path: '/search' },
    ...this.navigation().slice(1),
  ]);

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
    this.query()?.nativeElement.focus();
  }

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
