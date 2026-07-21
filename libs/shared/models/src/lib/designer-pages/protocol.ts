/**
 * The contract between the trusted host and an untrusted, sandboxed designer
 * page. The host renders a design in a cross-origin sandboxed iframe and speaks
 * to it only through `postMessage` using the messages below. The design can
 * never reach the host's DOM, cookies, or auth.
 */

/** One track as shown on a release's designer page. */
export interface DesignerPageTrack {
  position: number;
  title: string;
  /** Playing time in milliseconds, or null if not yet known. */
  durationMs: number | null;
}

/** How a release is priced, flattened for display inside a design. */
export interface DesignerPagePrice {
  mode: 'free' | 'fixed' | 'name_your_price';
  /** ISO 4217, lowercase. Null for a free release. */
  currency: string | null;
  /** Floor the buyer must pay, in minor units. Null for free. */
  minimumPrice: number | null;
  /** Optional suggested amount, in minor units. */
  suggestedPrice: number | null;
}

/** The release data a design renders. */
export interface DesignerPageRelease {
  id: string;
  title: string;
  artistName: string;
  tracks: DesignerPageTrack[];
  price: DesignerPagePrice;
}

/**
 * The artist's customization values, text and asset-URL overrides keyed by
 * slot name.
 */
export type DesignerPageCustomization = Record<string, string>;

/**
 * Everything the host injects into a design so it can render itself. Delivered
 * in the `designer-page:init` message once the design signals it is ready.
 */
export interface DesignerPageRenderPayload {
  release: DesignerPageRelease;
  customization: DesignerPageCustomization;
}

/**
 * What the API returns for "render this release with this design": where to load
 * the (untrusted) bundle from, and the data to inject into it.
 */
export interface DesignerPageRenderResponse {
  /** Short-lived signed URL to the design bundle in object storage. */
  bundleUrl: string;
  payload: DesignerPageRenderPayload;
}

/** Messages the trusted host sends into the sandboxed design. */
export type HostToDesignMessage = {
  type: 'designer-page:init';
  payload: DesignerPageRenderPayload;
};

/**
 * Messages the sandboxed design sends out to the trusted host. The design can
 * only *request* actions; the host decides whether and how to act on them.
 */
export type DesignToHostMessage =
  | { type: 'designer-page:ready' }
  | { type: 'designer-page:resize'; height: number }
  | { type: 'designer-page:purchase' }
  | { type: 'designer-page:play'; trackPosition: number };

/** Narrow an unknown `postMessage` payload to a design-to-host message. */
export function isDesignToHostMessage(
  value: unknown,
): value is DesignToHostMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    (value as { type: string }).type.startsWith('designer-page:')
  );
}
