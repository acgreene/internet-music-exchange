import { z } from 'zod';
import type { RouteContracts } from '../contract';
import { availabilitySchema, timestampSchema } from '../general';
import { HttpMethod } from '../http-method';
import { ApiRoute } from './routes';

/**
 * Anyone's public profile, `/users/<username>`.
 */
export const publicUserSchema = z.object({
  id: z.guid(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  createdAt: timestampSchema,
});

export type PublicUser = z.infer<typeof publicUserSchema>;

/**
 * The signed-in user's own profile.
 */
export const ownUserSchema = publicUserSchema.extend({
  suspendedAt: timestampSchema.nullable(),
  /** Platform admins see the admin tools. */
  isAdmin: z.boolean(),
});

export type OwnUser = z.infer<typeof ownUserSchema>;

export const updateProfileRequestSchema = z.object({
  username: z.string().optional(),
  name: z.string().nullable().optional(),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/**
 * `?artistId=` when checking a new handle for an existing artist, so its own
 * handle counts as free.
 */
export const handleAvailabilityQuerySchema = z.object({
  artistId: z.guid().optional(),
});

export const accountContracts = {
  [ApiRoute.Me]: {
    [HttpMethod.Get]: { response: ownUserSchema },
    [HttpMethod.Patch]: {
      request: updateProfileRequestSchema,
      response: publicUserSchema,
    },
  },
  [ApiRoute.UserProfile]: {
    [HttpMethod.Get]: { response: publicUserSchema },
  },
  [ApiRoute.UsernameAvailability]: {
    [HttpMethod.Get]: { response: availabilitySchema },
  },
  [ApiRoute.HandleAvailability]: {
    [HttpMethod.Get]: {
      query: handleAvailabilityQuerySchema,
      response: availabilitySchema,
    },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
