import { z } from 'zod';

/**
 * A validated acknowledgement.
 */
export type AckResponse = z.infer<typeof ackSchema>;

/**
 * Body the API returns for actions with no data.
 */
export const ackSchema = z.object({ success: z.literal(true) });
