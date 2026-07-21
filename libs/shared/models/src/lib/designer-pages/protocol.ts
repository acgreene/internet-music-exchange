/**
 * The contract between the trusted host and an untrusted, sandboxed design.
 * Every message type is namespaced so it cannot be confused with other
 * `postMessage` traffic on the page.
 */

export interface DesignerPageTrack {
  position: number;
  title: string;
  durationMs: number | null;
}

export interface DesignerPagePrice {
  mode: 'free' | 'fixed' | 'name_your_price';
  /** ISO 4217, lowercase. Null for a free release. */
  currency: string | null;
  /** Minor units. Null for a free release. */
  minimumPrice: number | null;
  suggestedPrice: number | null;
}

export interface DesignerPageRelease {
  id: string;
  title: string;
  artistName: string;
  tracks: DesignerPageTrack[];
  price: DesignerPagePrice;
}

/** Text and asset URL overrides, keyed by slot name. */
export type DesignerPageCustomization = Record<string, string>;

export interface DesignerPageRenderPayload {
  release: DesignerPageRelease;
  customization: DesignerPageCustomization;
}

export interface DesignerPageRenderResponse {
  /** Short-lived signed URL to the design bundle in object storage. */
  bundleUrl: string;
  payload: DesignerPageRenderPayload;
}

export type HostToDesignMessage = {
  type: 'designer-page:init';
  payload: DesignerPageRenderPayload;
};

/** A design can only request actions. The host decides whether to act. */
export type DesignToHostMessage =
  | { type: 'designer-page:ready' }
  | { type: 'designer-page:resize'; height: number }
  | { type: 'designer-page:purchase' }
  | { type: 'designer-page:play'; trackPosition: number };

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
