import {
  ArtistRepository,
  DesignRepository,
  EntitlementRepository,
  FundingRepository,
  JobRunRepository,
  ModerationRepository,
  OrderRepository,
  PaymentRepository,
  ProductRepository,
  ReleaseAssetRepository,
  ReleaseRepository,
  ShelfRepository,
  SocialRepository,
  UserRepository,
} from './repositories';
import { DatabaseService, type Db } from './database-service';

export class DatabaseRepository {
  public readonly artists: ArtistRepository;
  public readonly designs: DesignRepository;
  public readonly entitlements: EntitlementRepository;
  public readonly funding: FundingRepository;
  public readonly jobRuns: JobRunRepository;
  public readonly moderation: ModerationRepository;
  public readonly orders: OrderRepository;
  public readonly payments: PaymentRepository;
  public readonly products: ProductRepository;
  public readonly releaseAssets: ReleaseAssetRepository;
  public readonly releases: ReleaseRepository;
  public readonly shelves: ShelfRepository;
  public readonly social: SocialRepository;
  public readonly users: UserRepository;

  constructor(private readonly db: Db = DatabaseService.getInstance().db) {
    this.artists = new ArtistRepository(db);
    this.designs = new DesignRepository(db);
    this.entitlements = new EntitlementRepository(db);
    this.funding = new FundingRepository(db);
    this.jobRuns = new JobRunRepository(db);
    this.moderation = new ModerationRepository(db);
    this.orders = new OrderRepository(db);
    this.payments = new PaymentRepository(db);
    this.products = new ProductRepository(db);
    this.releaseAssets = new ReleaseAssetRepository(db);
    this.releases = new ReleaseRepository(db);
    this.shelves = new ShelfRepository(db);
    this.social = new SocialRepository(db);
    this.users = new UserRepository(db);
  }

  /**
   * Run several repository calls as one transaction: they all apply, or none
   * do.
   *
   * @param work - Gets repositories bound to the transaction.
   */
  public transaction<T>(
    work: (repos: DatabaseRepository) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => work(new DatabaseRepository(tx)));
  }
}
