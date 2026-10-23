import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import {
  type ArtistPagePlayback,
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
 *
 * Filling, the frame takes the whole box it is given and the design scrolls
 * inside it, as its own page does, so scroll effects and full-screen scenes
 * work. Otherwise the frame grows to the height the design reports.
 */
@Component({
  selector: 'ime-artist-page-host',
  templateUrl: './artist-page-host.component.html',
  host: { '[class.block]': 'fill()', '[class.h-full]': 'fill()' },
})
export class ArtistPageHost {
  /** The signed URL to the design's bundle */
  public readonly bundleUrl = input.required<string>();

  /** The release data the design is about to render */
  public readonly payload = input.required<ArtistPageRenderPayload>();

  /** Take the whole box and let the design scroll inside it. */
  public readonly fill = input(false, { transform: booleanAttribute });

  /** What is playing from this record, passed on to the design. */
  public readonly playback = input<ArtistPagePlayback | null>(null);

  /** Emitted when the design requests a purchase */
  public readonly purchaseRequested = output<void>();

  /** Emitted when the design asks to pause what is playing */
  public readonly pauseRequested = output<void>();

  /**
   * Emitted when the design requests playback of a track where number
   * is the track index position in the release
   */
  public readonly playRequested = output<number>();

  protected readonly frameHeight = signal(INITIAL_FRAME_HEIGHT_PX);

  /**
   * Set once the host listens for messages. The frame only loads after,
   * since a design says it is ready as soon as it loads, and a frame in a
   * server render would load before the page hydrates.
   */
  protected readonly listening = signal(false);

  private readonly iframeElementRef =
    viewChild<ElementRef<HTMLIFrameElement>>('frame');

  /** The design has been sent the release, so it can hear about playback. */
  private readonly initialized = signal(false);

  private readonly sanitizer = inject(DomSanitizer);

  /** The URL comes from our API, and the sandbox is what contains the frame. */
  protected readonly safeBundleUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.bundleUrl()),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    // browser only: a server render has no window, and the frame only ever
    // loads in the browser
    afterNextRender(() => {
      const onMessage = (event: MessageEvent) => this.handleMessage(event);
      window.addEventListener('message', onMessage);
      destroyRef.onDestroy(() =>
        window.removeEventListener('message', onMessage),
      );
      this.listening.set(true);
    });

    effect(() => {
      const playback = this.playback();
      if (playback && this.initialized()) this.send(playback);
    });
  }

  /**
   * Handles messages from the 3rd party design.
   * @param messageEvent
   * @private
   */
  private handleMessage(messageEvent: MessageEvent): void {
    const frameWindow = this.iframeElementRef()?.nativeElement.contentWindow;

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
      case ArtistPageProtocolMessage.Pause:
        this.pauseRequested.emit();
        break;
    }
  }

  private initializeIFrame(): void {
    this.iframeElementRef()?.nativeElement.contentWindow?.postMessage(
      {
        type: ArtistPageProtocolMessage.Init,
        payload: this.payload(),
      },
      '*',
    );
    this.initialized.set(true);
    const playback = this.playback();
    if (playback) this.send(playback);
  }

  private send(playback: ArtistPagePlayback): void {
    this.iframeElementRef()?.nativeElement.contentWindow?.postMessage(
      { type: ArtistPageProtocolMessage.Playback, playback },
      '*',
    );
  }
}
