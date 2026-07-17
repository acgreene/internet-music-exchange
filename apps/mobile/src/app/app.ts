import { Component, afterNextRender, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Header, type ApiStatus } from '@ime/ui';
import type { ApiHealth } from '@ime/models';

@Component({
  imports: [Header, RouterModule],
  selector: 'ime-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly apiStatus = signal<ApiStatus>('checking');

  constructor() {
    afterNextRender(() => {
      fetch('/api/health')
        .then((res): Promise<ApiHealth> => {
          if (!res.ok) {
            throw new Error(`API responded with ${res.status}`);
          }
          return res.json();
        })
        .then((health) =>
          this.apiStatus.set(health.status === 'ok' ? 'online' : 'offline')
        )
        .catch(() => this.apiStatus.set('offline'));
    });
  }
}
