import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '@ime/api-service';
import { SandboxedPageHost } from '@ime/client-designer-pages';
import type { DesignerPageRenderResponse } from '@ime/models';

/**
 * Trusted page that renders a release as a designer page. It fetches the
 * release data and the design bundle URL, hands both to the sandboxed host, and
 * owns every action the design asks for, the design itself can only request.
 */
@Component({
  selector: 'ime-designer-page',
  imports: [SandboxedPageHost],
  template: `
    @if (rendered(); as page) {
      <ime-sandboxed-page-host
        [bundleUrl]="page.bundleUrl"
        [payload]="page.payload"
        (purchaseRequested)="onPurchaseRequested()"
        (playRequested)="onPlayRequested($event)"
      />
      @if (lastAction(); as action) {
        <p data-testid="host-action">{{ action }}</p>
      }
    } @else if (error(); as message) {
      <p data-testid="error">{{ message }}</p>
    } @else {
      <p data-testid="loading">Loading…</p>
    }
  `,
})
export class DesignerPage {
  protected readonly rendered = signal<DesignerPageRenderResponse | null>(null);
  protected readonly error = signal<string | null>(null);

  /**
   * What the trusted host last did in response to the design. Stands in for the
   * real checkout and player until those exist.
   */
  protected readonly lastAction = signal<string | null>(null);

  private readonly api = inject(ApiService);

  constructor() {
    const releaseId =
      inject(ActivatedRoute).snapshot.paramMap.get('releaseId') ?? '';

    void this.load(releaseId);
  }

  /**
   * The design asked to buy. A real checkout goes here; the point is that it
   * runs in trusted code, never inside the sandboxed frame.
   */
  protected onPurchaseRequested(): void {
    const title = this.rendered()?.payload.release.title ?? 'this release';
    this.lastAction.set(`Host received purchase intent for "${title}"`);
  }

  protected onPlayRequested(trackPosition: number): void {
    this.lastAction.set(`Host received play intent for track ${trackPosition}`);
  }

  private async load(releaseId: string): Promise<void> {
    const result = await this.api.designerPageForRelease(releaseId);
    if (result.ok) {
      this.rendered.set(result.data);
      return;
    }
    this.error.set(result.error.message);
  }
}
