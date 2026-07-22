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
  ArtistPageProtocolMessage,
  type ArtistPageRenderPayload,
  isDesignToHostMessage,
} from '@ime/models';

const INITIAL_FRAME_HEIGHT_PX = 640;

/**
 * Renders a third party design in a sandboxed frame and is the only code that
 * talks to it.
 *
 * Notes:
 * The frame is sandboxed with `allow-scripts` and not `allow-same-origin`.
 * The design's scripts run, but the frame gets an opaque origin and cannot
 * reach this document, its cookies, or its storage.
 *
 * A design can only request actions. Acting on a request stays in trusted code.
 */
@Component({
  selector: 'ime-artist-page-host',
  templateUrl: './artist-page-host.component.html',
})
export class ArtistPageHost {
  /** The signed URL to the design's bundle */
  public readonly bundleUrl = input.required<string>();

  /** The release data the design is about to render */
  public readonly payload = input.required<ArtistPageRenderPayload>();

  /** Emitted when the design requests a purchase */
  public readonly purchaseRequested = output<void>();

  /**
   * Emitted when the design requests playback of a track where number
   * is the track index position in the release
   */
  public readonly playRequested = output<number>();

  protected readonly frameHeight = signal(INITIAL_FRAME_HEIGHT_PX);

  private readonly iframeElementRef =
    viewChild.required<ElementRef<HTMLIFrameElement>>('frame');

  private readonly sanitizer = inject(DomSanitizer);

  /** The URL comes from our API, and the sandbox is what contains the frame. */
  protected readonly safeBundleUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.bundleUrl()),
  );

  constructor() {
    // listen to messages from the iframe and handle them
    window.addEventListener('message', (e: MessageEvent) => {
      this.handleMessage(e);
    });
    inject(DestroyRef).onDestroy(() =>
      window.removeEventListener('message', (e: MessageEvent) => {
        this.handleMessage(e);
      }),
    );
  }

  /**
   * Handles messages from the 3rd party design.
   * @param messageEvent
   * @private
   */
  private handleMessage(messageEvent: MessageEvent): void {
    const frameWindow = this.iframeElementRef().nativeElement.contentWindow;

    // don't do anything if the message source isn't coming from the frame
    if (!frameWindow || messageEvent.source !== frameWindow) {
      return;
    }

    if (!isDesignToHostMessage(messageEvent.data)) {
      return;
    }

    switch (messageEvent.data.type) {
      case ArtistPageProtocolMessage.Ready:
        this.initializeIFrame();
        break;
      case ArtistPageProtocolMessage.Resize:
        this.frameHeight.set(Math.max(0, Math.ceil(messageEvent.data.height)));
        break;
      case ArtistPageProtocolMessage.Purchase:
        this.purchaseRequested.emit();
        break;
      case ArtistPageProtocolMessage.Play:
        this.playRequested.emit(messageEvent.data.trackPosition);
        break;
    }
  }

  private initializeIFrame(): void {
    this.iframeElementRef().nativeElement.contentWindow?.postMessage(
      {
        type: ArtistPageProtocolMessage.Init,
        payload: this.payload(),
      },
      '*',
    );
  }
}
