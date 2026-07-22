import {
  ArtistPageRepository,
  ArtistRepository,
  EntitlementRepository,
  OrderRepository,
  PaymentRepository,
  ProductRepository,
  ReleaseAssetRepository,
  ReleaseRepository,
  SocialRepository,
  UserRepository,
} from './repositories';
import { DatabaseService, type Db } from './database-service';

export class DatabaseRepository {
  public readonly artistPages: ArtistPageRepository;
  public readonly artists: ArtistRepository;
  public readonly entitlements: EntitlementRepository;
  public readonly orders: OrderRepository;
  public readonly payments: PaymentRepository;
  public readonly products: ProductRepository;
  public readonly releaseAssets: ReleaseAssetRepository;
  public readonly releases: ReleaseRepository;
  public readonly social: SocialRepository;
  public readonly users: UserRepository;

  constructor(db: Db = DatabaseService.getInstance().db) {
    this.artistPages = new ArtistPageRepository(db);
    this.artists = new ArtistRepository(db);
    this.entitlements = new EntitlementRepository(db);
    this.orders = new OrderRepository(db);
    this.payments = new PaymentRepository(db);
    this.products = new ProductRepository(db);
    this.releaseAssets = new ReleaseAssetRepository(db);
    this.releases = new ReleaseRepository(db);
    this.social = new SocialRepository(db);
    this.users = new UserRepository(db);
  }
}
