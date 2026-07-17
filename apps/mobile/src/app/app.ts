import { Component, afterNextRender, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ApiStatus, HealthStatus } from '@ime/models';
import { ApiService } from '@ime/api-service';
import { Header } from '@ime/ui';

@Component({
  imports: [Header, RouterModule],
  selector: 'ime-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly api = inject(ApiService);
  protected readonly apiStatus = signal<ApiStatus>(ApiStatus.Checking);

  constructor() {
    afterNextRender(() => {
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
}
