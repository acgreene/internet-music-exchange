import { Component, computed, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { type DesignerPageRenderPayload, type HostToDesignMessage, isDesignToHostMessage } from '@ime/models';

/**
 * Height the frame starts at before the design reports its own, so the page
 * does not flash at zero height.
 */
const INITIAL_FRAME_HEIGHT_PX = 640;

/**
 * Renders an untrusted designer page inside a sandboxed iframe and is the only
 * thing that talks to it.
 */
@Component({
  selector: 'ime-sandboxed-page-host',
  template: `
    <iframe
      #frame
      title="Designer page"
      [src]="safeBundleUrl()"
      [height]="frameHeight()"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      width="100%"
      style="border: 0; display: block;"
    ></iframe>
  `,
})
export class SandboxedPageHost {
  /** Short-lived URL of the design bundle, from the API. */
  public readonly bundleUrl = input.required<string>();

  /** Data injected into the design once it reports itself ready. */
  public readonly payload = input.required<DesignerPageRenderPayload>();

  /** The design asked to buy the release. Trusted code decides what happens. */
  public readonly purchaseRequested = output<void>();

  /** The design asked to play a track, by its position in the release. */
  public readonly playRequested = output<number>();

  protected readonly frameHeight = signal(INITIAL_FRAME_HEIGHT_PX);

  private readonly frame =
    viewChild.required<ElementRef<HTMLIFrameElement>>('frame');

  private readonly sanitizer = inject(DomSanitizer);

  protected readonly safeBundleUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.bundleUrl()),
  );

  constructor() {
    const onMessage = (event: MessageEvent) => this.handleMessage(event);
    window.addEventListener('message', onMessage);
    inject(DestroyRef).onDestroy(() =>
      window.removeEventListener('message', onMessage),
    );
  }

  /**
   * Handle one message from the sandboxed design, ignoring anything that did
   * not come from this frame or does not match the protocol.
   */
  private handleMessage(event: MessageEvent): void {
    const frameWindow = this.frame().nativeElement.contentWindow;
    if (!frameWindow || event.source !== frameWindow) {
      return;
    }

    if (!isDesignToHostMessage(event.data)) {
      return;
    }

    switch (event.data.type) {
      case 'designer-page:ready':
        this.sendInit();
        break;
      case 'designer-page:resize':
        this.frameHeight.set(Math.max(0, Math.ceil(event.data.height)));
        break;
      case 'designer-page:purchase':
        this.purchaseRequested.emit();
        break;
      case 'designer-page:play':
        this.playRequested.emit(event.data.trackPosition);
        break;
    }
  }

  /**
   * Hand the design its data.
   */
  private sendInit(): void {
    const message: HostToDesignMessage = {
      type: 'designer-page:init',
      payload: this.payload(),
    };

    this.frame().nativeElement.contentWindow?.postMessage(message, '*');
  }
}
