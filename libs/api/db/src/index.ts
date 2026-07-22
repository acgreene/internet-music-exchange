export * from './lib/schema';
export * from './lib/database-service';

/**
 * Only export the master db repository class, which holds instances of all
 * other domain repositories. This way the programmer can just grab a single
 * repository and access any of the query helpers across all domains from one
 * object and not have to recall all the individual repositories.
 */
export * from './lib/database-repository';
