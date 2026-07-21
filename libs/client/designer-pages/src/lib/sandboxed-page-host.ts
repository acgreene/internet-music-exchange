import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import {
  type DesignerPageRenderPayload,
  type HostToDesignMessage,
  isDesignToHostMessage,
} from '@ime/models';

const INITIAL_FRAME_HEIGHT_PX = 640;

/**
 * Renders an untrusted design in a sandboxed frame and is the only code that
 * talks to it.
 *
 * The frame is sandboxed with `allow-scripts` and deliberately without
 * `allow-same-origin`. The design's scripts run, but the frame gets an opaque
 * origin and cannot reach this document, its cookies, or its storage. Granting
 * both tokens together would defeat the sandbox.
 *
 * A design can only request actions. Acting on a request stays in trusted code.
 */
@Component({
  selector: 'ime-sandboxed-page-host',
  templateUrl: './sandboxed-page-host.html',
})
export class SandboxedPageHost {
  public readonly bundleUrl = input.required<string>();
  public readonly payload = input.required<DesignerPageRenderPayload>();

  public readonly purchaseRequested = output<void>();
  public readonly playRequested = output<number>();

  protected readonly frameHeight = signal(INITIAL_FRAME_HEIGHT_PX);

  private readonly frame =
    viewChild.required<ElementRef<HTMLIFrameElement>>('frame');

  private readonly sanitizer = inject(DomSanitizer);

  /** The URL comes from our API, and the sandbox is what contains the frame. */
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
   * An opaque origin frame sends `origin: "null"`, so messages are
   * authenticated against this frame's window rather than by origin.
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

  private sendInit(): void {
    const message: HostToDesignMessage = {
      type: 'designer-page:init',
      payload: this.payload(),
    };

    // An opaque origin frame has no origin to address. The payload is the
    // public release data the design is about to render.
    this.frame().nativeElement.contentWindow?.postMessage(message, '*');
  }
}
