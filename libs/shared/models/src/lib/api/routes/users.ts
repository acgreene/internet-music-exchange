import { z } from 'zod';

/**
 * Acknowledgement for actions with no data to return.
 */
export const ackResponseSchema = z.object({
  success: z.literal(true),
});

/**
 * A validated acknowledgement.
 */
export type AckResponse = z.infer<typeof ackResponseSchema>;
