import { inject, Injectable, RESPONSE_INIT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface PageMeta {
  title: string;
  description?: string;
  image?: string | null;
}

/**
 * The tab title and link-preview tags for a page whose name comes from its
 * data, such as a release or an artist.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly response = inject(RESPONSE_INIT, { optional: true });

  public set({ title, description, image }: PageMeta): void {
    this.title.setTitle(`${title} | IME`);
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
    } else {
      this.meta.removeTag("name='description'");
      this.meta.removeTag("property='og:description'");
    }
    if (image) {
      this.meta.updateTag({ property: 'og:image', content: image });
    } else {
      this.meta.removeTag("property='og:image'");
    }
  }

  /**
   * Title the page as missing, and answer a server render with 404 so search
   * engines drop the address.
   */
  public notFound(): void {
    this.title.setTitle('Not found | IME');
    if (this.response) this.response.status = 404;
  }
}
