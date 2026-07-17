import { z } from 'zod';

/**
 * Overall health of the service. Values are wire format and must stay stable.
 */
export enum HealthStatus {
  /**
   * The service and its dependencies are operating normally.
   */
  Ok = 'ok',

  /**
   * The service is up, but a dependency (such as the database) is unreachable.
   */
  Degraded = 'degraded',
}

/**
 * Contract for GET /api/health responses.
 */
export const healthResponseSchema = z.object({
  status: z.enum(HealthStatus),
  timestamp: z.iso.datetime(),
});

/**
 * A validated health check response.
 */
export type HealthResponse = z.infer<typeof healthResponseSchema>;
