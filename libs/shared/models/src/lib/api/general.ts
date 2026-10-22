import { z } from 'zod';

/**
 * A validated acknowledgement.
 */
export type AckResponse = z.infer<typeof ackSchema>;

/**
 * Body the API returns for actions with no data.
 */
export const ackSchema = z.object({ success: z.literal(true) });

/**
 * A moment in time. The API returns dates, they travel as ISO strings, and
 * parsing turns them back into dates on the other side.
 */
export const timestampSchema = z.coerce.date();

/**
 * Paging for any list: `?limit=` up to 100 and `?offset=`.
 */
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * Asks for somewhere to upload a file of one type.
 */
export const uploadRequestSchema = z.object({
  contentType: z.string().min(1),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/**
 * Where to upload a file directly, and the key to confirm it with afterwards.
 */
export const uploadTargetSchema = z.object({
  uploadUrl: z.string(),
  objectKey: z.string(),
});

export type UploadTargetResponse = z.infer<typeof uploadTargetSchema>;

/**
 * Confirms a file uploaded under a key the API handed out.
 */
export const confirmUploadRequestSchema = z.object({
  objectKey: z.string().min(1),
});

/**
 * A short-lived link to open a file.
 */
export const signedUrlSchema = z.object({ url: z.string() });

export type SignedUrlResponse = z.infer<typeof signedUrlSchema>;

/**
 * Whether a name is free to take.
 */
export const availabilitySchema = z.object({ available: z.boolean() });

export type AvailabilityResponse = z.infer<typeof availabilitySchema>;
