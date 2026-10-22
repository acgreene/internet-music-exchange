import * as z from 'zod';
import type { RouteContracts } from '../contract';
import { HttpMethod } from '../http-method';
import { releaseCardWithArtistSchema } from './catalog';
import { pricingSchema } from './releases';
import { ApiRoute } from './routes';

/** The periods a chart covers, each ending at the start of this week. */
export const CHART_PERIODS = [
  { id: 'week', name: 'This week', weeks: 1 },
  { id: 'month', name: 'This month', weeks: 4 },
  { id: 'year', name: 'This year', weeks: 52 },
  { id: 'all', name: 'All time', weeks: null },
] as const;

export type ChartPeriod = (typeof CHART_PERIODS)[number]['id'];

export const chartFormatSchema = z.enum(['digital', 'vinyl', 'cassette', 'cd']);

export const chartQuerySchema = z.object({
  period: z.enum(['week', 'month', 'year', 'all']).optional(),
  genre: z.string().optional(),
  format: chartFormatSchema.optional(),
});

export type ChartQuery = z.infer<typeof chartQuerySchema>;

/**
 * A release's place on a chart, ranked by how many people bought or claimed
 * it, never by money.
 */
export const chartEntrySchema = z.object({
  position: z.number().int(),
  release: releaseCardWithArtistSchema,
  pricing: pricingSchema.nullable(),
  /** How many people bought or claimed it in the period. */
  people: z.number().int(),
  /** Its place on last week's chart, or null when it is new. */
  previous: z.number().int().nullable(),
  /** Its best place on the weekly chart, all formats. */
  peak: z.number().int().nullable(),
  /** How many weeks it has been on the weekly chart. */
  weeks: z.number().int(),
});

export type ChartEntry = z.infer<typeof chartEntrySchema>;

export const chartSchema = z.object({
  period: z.enum(['week', 'month', 'year', 'all']),
  genre: z.string().nullable(),
  format: chartFormatSchema.nullable(),
  /** The first day counted, `YYYY-MM-DD`; null for all time. */
  from: z.string().nullable(),
  /** The last day counted, `YYYY-MM-DD`. */
  through: z.string(),
  entries: z.array(chartEntrySchema),
});

export type Chart = z.infer<typeof chartSchema>;

export const chartContracts = {
  [ApiRoute.Charts]: {
    [HttpMethod.Get]: { query: chartQuerySchema, response: chartSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
