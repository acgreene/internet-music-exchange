import {
  DatabaseRepository,
  type ProductType,
  type ShelfProduct,
  type ShelfRelease,
} from '@ime/db';
import type { ShelfItem } from '@ime/models';
import { CloudStorageService } from '../storage';

const IMAGE_URL_EXPIRY_SECONDS = 3600;

type ReleaseItem = Extract<ShelfItem, { kind: 'release' }>;
type ProductItem = Extract<ShelfItem, { kind: 'product' }>;

/**
 * Turns catalog rows into the cards listeners see, with their covers and
 * images signed for an hour.
 */
export class CatalogCards {
  constructor(
    private readonly db: DatabaseRepository,
    private readonly storage: CloudStorageService,
  ) {}

  public async releases(rows: ShelfRelease[]): Promise<ReleaseItem[]> {
    const covers = new Map(
      (await this.db.releaseAssets.listCovers(rows.map((r) => r.id))).map(
        (cover) => [cover.releaseId, cover.objectKey],
      ),
    );
    return Promise.all(
      rows.map(async (row) => {
        const key = covers.get(row.id);
        return {
          kind: 'release' as const,
          release: {
            id: row.id,
            artistId: row.artistId,
            title: row.title,
            slug: row.slug,
            kind: row.kind,
            releasedAt: row.releasedAt,
            publishedAt: row.publishedAt,
            artistName: row.artistName,
            artistHandle: row.artistHandle,
            coverUrl: key ? await this.signedUrl(key) : null,
          },
          pricing: row.pricingMode
            ? {
                mode: row.pricingMode,
                currency: row.currency,
                minimumPrice: row.minimumPrice ?? 0,
                suggestedPrice: row.suggestedPrice,
              }
            : null,
        };
      }),
    );
  }

  public async products(rows: ShelfProduct[]): Promise<ProductItem[]> {
    const images = new Map(
      (await this.db.products.listPrimaryImages(rows.map((r) => r.id))).map(
        (image) => [image.productId, image.objectKey],
      ),
    );
    return Promise.all(
      rows.map(async (row) => {
        const key = images.get(row.id);
        return {
          kind: 'product' as const,
          id: row.id,
          name: row.name,
          productType: row.type as ProductType,
          artistName: row.artistName,
          artistHandle: row.artistHandle,
          imageUrl: key ? await this.signedUrl(key) : null,
          currency: row.currency,
          price: row.price,
        };
      }),
    );
  }

  /** Each release's cover, signed, for those that have one. */
  public async coverUrls(releaseIds: string[]): Promise<Map<string, string>> {
    const covers = await this.db.releaseAssets.listCovers(releaseIds);
    return new Map(
      await Promise.all(
        covers.map(
          async (cover) =>
            [cover.releaseId, await this.signedUrl(cover.objectKey)] as const,
        ),
      ),
    );
  }

  private signedUrl(objectKey: string): Promise<string> {
    return this.storage.getObjectSignedUrl(objectKey, IMAGE_URL_EXPIRY_SECONDS);
  }
}
