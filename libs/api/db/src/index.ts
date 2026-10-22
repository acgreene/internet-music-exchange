export * from './lib/schema';
export * from './lib/database-service';
export * from './lib/postgres-error-code';

/**
 * Only export the master db repository class, which holds instances of all
 * other domain repositories. This way the programmer can just grab a single
 * repository and access any of the query helpers across all domains from one
 * object and not have to recall all the individual repositories.
 */
export * from './lib/database-repository';

/**
 * The shapes repository queries return, as types only, so services can name
 * them. Checkout also needs to catch the stock error by class.
 */
export type * from './lib/repositories';
export { InsufficientStockError } from './lib/repositories/order-repository';
