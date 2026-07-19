import { Component, afterNextRender, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ApiStatus, HealthStatus } from '@ime/models';
import { ApiService, AuthStore } from '@ime/api-service';
import { Header, RetroMarquee } from '@ime/ui';

@Component({
  imports: [Header, RetroMarquee, RouterModule],
  selector: 'ime-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthStore);
  protected readonly apiStatus = signal<ApiStatus>(ApiStatus.Checking);

  /**
   * Phrases for the desktop ticker.
   */
  protected readonly tickerItems = [
    'zero platform cut',
    'human-made music',
    'artist pages are art',
    'community owned',
    'est. 2026',
  ];

  constructor() {
    afterNextRender(() => {
      this.auth.start();
      void this.api.health().then((result) => {
        if (!result.ok) {
          this.apiStatus.set(ApiStatus.Offline);
          return;
        }
        this.apiStatus.set(
          result.data.status === HealthStatus.Ok
            ? ApiStatus.Online
            : ApiStatus.Degraded,
        );
      });
    });
  }

  /**
   * Sign out and return to the desktop.
   */
  protected async signOut(): Promise<void> {
    await this.api.user.signOut();
    await this.router.navigateByUrl('/');
  }
}
