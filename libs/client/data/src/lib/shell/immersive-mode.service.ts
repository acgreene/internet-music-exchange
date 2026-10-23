import { Injectable, signal } from '@angular/core';

/**
 * Whether a page has taken over the whole window, as a designed release
 * does, so the shell steps back to almost nothing around it.
 */
@Injectable({ providedIn: 'root' })
export class ImmersiveMode {
  public readonly on = signal(false);
}
