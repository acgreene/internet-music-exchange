import { Component, afterNextRender, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ApiService } from '@ime/api-service';
import { Header, type ApiStatus } from '@ime/ui';

@Component({
  imports: [Header, RouterModule],
  selector: 'ime-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly api = inject(ApiService);
  protected readonly apiStatus = signal<ApiStatus>('checking');

  constructor() {
    afterNextRender(() => {
      void this.api.health().then((result) => {
        this.apiStatus.set(result.ok ? 'online' : 'offline');
      });
    });
  }
}
