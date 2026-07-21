import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '@ime/api-service';
import { SandboxedPageHost } from '@ime/client-designer-pages';
import type { DesignerPageRenderResponse } from '@ime/models';

/**
 * Renders a release as a designer page. Owns every action the design requests,
 * so nothing a design asks for runs inside the sandboxed frame.
 */
@Component({
  selector: 'ime-designer-page',
  imports: [SandboxedPageHost],
  templateUrl: './designer-page.html',
})
export class DesignerPage {
  protected readonly rendered = signal<DesignerPageRenderResponse | null>(null);
  protected readonly error = signal<string | null>(null);

  private readonly api = inject(ApiService);

  constructor() {
    const releaseId =
      inject(ActivatedRoute).snapshot.paramMap.get('releaseId') ?? '';

    void this.load(releaseId);
  }

  /** Where checkout is wired in once it exists. */
  protected onPurchaseRequested(): void {
    return;
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
