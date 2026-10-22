import * as z from 'zod';
import type { RouteContracts } from '../contract';
import { ackSchema, timestampSchema } from '../general';
import { HttpMethod } from '../http-method';
import { currencySchema } from './releases';
import { ApiRoute } from './routes';

/**
 * What a seller's payment account can do, as IME last heard from Stripe.
 */
export const payoutAccountStatusSchema = z.object({
  /** A Stripe account exists, whether or not onboarding is finished. */
  connected: z.boolean(),
  /** Paid releases, merch, and designs can be sold. */
  chargesEnabled: z.boolean(),
  /** Stripe pays the seller out to their bank. */
  payoutsEnabled: z.boolean(),
  /** The seller finished Stripe's onboarding form. */
  detailsSubmitted: z.boolean(),
  /** The selling currency, once Stripe knows it. */
  currency: currencySchema.nullable(),
});

export type PayoutAccountStatus = z.infer<typeof payoutAccountStatusSchema>;

/**
 * A page on another site to send the user to, such as Stripe's.
 */
export const redirectSchema = z.object({ url: z.string() });

export type RedirectResponse = z.infer<typeof redirectSchema>;

export const givingDestinationSchema = z.enum(['platform', 'developers']);

export const autoTopUpModeSchema = z.enum([
  'off',
  'monthly',
  'below_threshold',
]);

/**
 * A seller's alert and auto top-up settings, and whether they have lapsed.
 */
export const sellerBillingSchema = z.object({
  alertThresholdAmount: z.number().int().nullable(),
  alertThresholdPercent: z.number().int().nullable(),
  autoTopUpMode: autoTopUpModeSchema,
  autoTopUpAmount: z.number().int().nullable(),
  autoTopUpExtraAmount: z.number().int(),
  autoTopUpExtraDestination: givingDestinationSchema.nullable(),
  /** Set when the balance went below zero and could not be topped up. */
  lapsedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type SellerBillingResponse = z.infer<typeof sellerBillingSchema>;

export const balanceEntrySchema = z.object({
  id: z.guid(),
  kind: z.enum([
    'top_up',
    'monthly_charge',
    'credit',
    'withdrawal',
    'adjustment',
  ]),
  /** Positive adds to the balance, negative takes from it, in USD cents. */
  amount: z.number().int(),
  /** What the card network kept from a top-up. */
  cardFee: z.number().int().nullable(),
  note: z.string().nullable(),
  createdAt: timestampSchema,
});

export type BalanceEntryResponse = z.infer<typeof balanceEntrySchema>;

export const statementSchema = z.object({
  id: z.guid(),
  /** The month, `YYYY-MM-01`. */
  month: z.string(),
  usageAmount: z.number().int(),
  sharedAmount: z.number().int(),
  subsidyAmount: z.number().int(),
  cardFeesAmount: z.number().int(),
  totalAmount: z.number().int(),
  lines: z.array(
    z.object({
      artistId: z.guid().nullable(),
      designerUserId: z.guid().nullable(),
      name: z.string(),
      shareBasisPoints: z.number().int(),
      storageByteDays: z.number(),
      requests: z.number(),
      amount: z.number().int(),
    }),
  ),
  createdAt: timestampSchema,
});

export type StatementResponse = z.infer<typeof statementSchema>;

/**
 * Everything a seller sees about paying for hosting.
 */
export const billingOverviewSchema = z.object({
  billing: sellerBillingSchema.nullable(),
  hasCard: z.boolean(),
  balance: z.number().int(),
  recentEntries: z.array(balanceEntrySchema),
  statements: z.array(statementSchema),
});

export type BillingOverview = z.infer<typeof billingOverviewSchema>;

/**
 * The client secret the browser confirms a card or payment with, through
 * Stripe.
 */
export const clientSecretSchema = z.object({ clientSecret: z.string() });

export const confirmCardRequestSchema = z.object({
  setupIntentId: z.string().min(1),
});

export const billingSettingsRequestSchema = z.object({
  alertThresholdAmount: z.number().int().nullable().optional(),
  alertThresholdPercent: z.number().int().nullable().optional(),
  autoTopUpMode: autoTopUpModeSchema.optional(),
  autoTopUpAmount: z.number().int().nullable().optional(),
  autoTopUpExtraAmount: z.number().int().optional(),
  autoTopUpExtraDestination: givingDestinationSchema.nullable().optional(),
});

export type BillingSettingsRequest = z.infer<
  typeof billingSettingsRequestSchema
>;

export const topUpRequestSchema = z.object({
  /** What goes into the balance, in USD cents. */
  amount: z.number().int(),
  /** An optional gift on top. */
  extraAmount: z.number().int().optional(),
  extraDestination: givingDestinationSchema.optional(),
});

export type TopUpRequest = z.infer<typeof topUpRequestSchema>;

/**
 * How a top-up went. A card that needs the holder's approval returns a
 * client secret for the browser to finish it with.
 */
export const topUpResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('succeeded') }),
  z.object({ status: z.literal('requires_action'), clientSecret: z.string() }),
]);

export type TopUpResult = z.infer<typeof topUpResultSchema>;

export const balanceRefundSchema = z.object({
  /** What was refunded to the card, in USD cents. */
  refunded: z.number().int(),
});

const shareSchema = z.object({
  userId: z.guid(),
  /** Hundredths of a percent: 2500 is 25%. */
  shareBasisPoints: z.number().int(),
});

/**
 * How an artist's hosting costs are split between its managers, and any new
 * split waiting for everyone to accept it.
 */
export const costSplitSchema = z.object({
  shares: z.array(shareSchema.extend({ createdAt: timestampSchema })),
  proposal: z.array(
    shareSchema.extend({
      offeredByUserId: z.guid().nullable(),
      acceptedAt: timestampSchema.nullable(),
      createdAt: timestampSchema,
    }),
  ),
});

export type CostSplit = z.infer<typeof costSplitSchema>;

export const proposeSplitRequestSchema = z.object({
  shares: z.array(shareSchema),
});

/**
 * Accepting a share either waits on other managers or applies the split.
 */
export const acceptShareSchema = z.object({
  outcome: z.enum(['accepted', 'applied']),
});

export const donationRequestSchema = z.object({
  destination: givingDestinationSchema,
  cadence: z.enum(['one_time', 'monthly']),
  /** In USD cents. */
  amount: z.number().int(),
  /** Leave the donor's name off the gift. */
  anonymous: z.boolean().optional(),
});

export type DonationRequest = z.infer<typeof donationRequestSchema>;

export const publicCostsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).optional(),
});

/**
 * The public costs page: what running IME costs, how it is shared, and the
 * reserve. All amounts in USD cents.
 */
export const publicCostsSchema = z.object({
  months: z.array(
    z.object({
      month: z.string(),
      costsByCategory: z.partialRecord(
        z.enum([
          'storage_and_delivery',
          'hosting',
          'database',
          'other_services',
          'ownership_guarantee',
        ]),
        z.number().int(),
      ),
      totalCosts: z.number().int(),
      sellerCount: z.number().int(),
      medianShare: z.number().int(),
      subsidy: z.number().int(),
      platformDonations: z.number().int(),
    }),
  ),
  reserveBalance: z.number().int(),
});

export type PublicCosts = z.infer<typeof publicCostsSchema>;

export const fundingContracts = {
  [ApiRoute.ArtistPaymentAccount]: {
    [HttpMethod.Get]: { response: payoutAccountStatusSchema },
  },
  [ApiRoute.ArtistPaymentOnboarding]: {
    [HttpMethod.Post]: { response: redirectSchema },
  },
  [ApiRoute.ArtistPaymentRefresh]: {
    [HttpMethod.Post]: { response: payoutAccountStatusSchema },
  },
  [ApiRoute.MyPaymentAccount]: {
    [HttpMethod.Get]: { response: payoutAccountStatusSchema },
  },
  [ApiRoute.MyPaymentOnboarding]: {
    [HttpMethod.Post]: { response: redirectSchema },
  },
  [ApiRoute.MyPaymentRefresh]: {
    [HttpMethod.Post]: { response: payoutAccountStatusSchema },
  },
  [ApiRoute.MyBilling]: {
    [HttpMethod.Get]: { response: billingOverviewSchema },
  },
  [ApiRoute.MyBillingCardSetup]: {
    [HttpMethod.Post]: { response: clientSecretSchema },
  },
  [ApiRoute.MyBillingCard]: {
    [HttpMethod.Put]: {
      request: confirmCardRequestSchema,
      response: ackSchema,
    },
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.MyBillingSettings]: {
    [HttpMethod.Patch]: {
      request: billingSettingsRequestSchema,
      response: sellerBillingSchema,
    },
  },
  [ApiRoute.MyBillingTopUps]: {
    [HttpMethod.Post]: {
      request: topUpRequestSchema,
      response: topUpResultSchema,
    },
  },
  [ApiRoute.MyBillingRefund]: {
    [HttpMethod.Post]: { response: balanceRefundSchema },
  },
  [ApiRoute.ArtistCostSplit]: {
    [HttpMethod.Get]: { response: costSplitSchema },
    [HttpMethod.Put]: {
      request: proposeSplitRequestSchema,
      response: costSplitSchema,
    },
  },
  [ApiRoute.ArtistCostSplitAccept]: {
    [HttpMethod.Post]: { response: acceptShareSchema },
  },
  [ApiRoute.ArtistCostSplitProposal]: {
    [HttpMethod.Delete]: { response: ackSchema },
  },
  [ApiRoute.Donations]: {
    [HttpMethod.Post]: {
      request: donationRequestSchema,
      response: redirectSchema,
    },
  },
  [ApiRoute.PublicCosts]: {
    [HttpMethod.Get]: {
      query: publicCostsQuerySchema,
      response: publicCostsSchema,
    },
  },
  [ApiRoute.StripeWebhook]: {
    [HttpMethod.Post]: { response: ackSchema },
  },
  [ApiRoute.StripeConnectWebhook]: {
    [HttpMethod.Post]: { response: ackSchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
