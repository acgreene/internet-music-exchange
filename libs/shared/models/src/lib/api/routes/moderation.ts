import * as z from 'zod';
import type { RouteContracts } from '../contract';
import { ackSchema, timestampSchema } from '../general';
import { HttpMethod } from '../http-method';
import { ApiRoute } from './routes';

/**
 * The kinds of thing that can be reported or moderated.
 */
export const moderationTargetSchema = z.enum([
  'release',
  'product',
  'comment',
  'design',
  'artist',
  'user',
]);

export type ModerationTarget = z.infer<typeof moderationTargetSchema>;

export const reportReasonSchema = z.enum([
  'hate_or_harassment',
  'copyright',
  'illegal_content',
  'harmful_design_code',
  'spam',
  'other',
]);

export type ReportReason = z.infer<typeof reportReasonSchema>;

export const reportSchema = z.object({
  id: z.guid(),
  /** Null for a copyright claim sent without an account. */
  reporterUserId: z.guid().nullable(),
  claimantName: z.string().nullable(),
  claimantEmail: z.string().nullable(),
  targetType: moderationTargetSchema,
  targetId: z.guid(),
  reason: reportReasonSchema,
  note: z.string().nullable(),
  status: z.enum(['open', 'dismissed', 'actioned']),
  resolvedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type ReportResponse = z.infer<typeof reportSchema>;

export const moderationActionSchema = z.object({
  id: z.guid(),
  /** Null for what IME did on its own, such as finalizing a takedown. */
  adminUserId: z.guid().nullable(),
  action: z.enum([
    'dismiss',
    'take_down',
    'finalize_takedown',
    'restore',
    'suspend',
    'unsuspend',
    'clear_profile',
  ]),
  targetType: moderationTargetSchema,
  targetId: z.guid(),
  reason: reportReasonSchema.nullable(),
  note: z.string().nullable(),
  createdAt: timestampSchema,
});

export type ModerationActionResponse = z.infer<typeof moderationActionSchema>;

export const copyrightContestSchema = z.object({
  id: z.guid(),
  releaseId: z.guid(),
  contestedByUserId: z.guid().nullable(),
  statement: z.string(),
  outcome: z.enum(['upheld', 'rejected']).nullable(),
  resolvedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type CopyrightContestResponse = z.infer<typeof copyrightContestSchema>;

/**
 * What a reported item is, for an admin to recognize it.
 */
export const moderationSubjectSchema = z.object({
  /** Its name or title, or an excerpt of a comment. */
  label: z.string(),
  /** Who it belongs to or where it appears, when that helps. */
  context: z.string().nullable(),
  /** Where it lives in the web app, while it can be seen. */
  path: z.string().nullable(),
  /** Taken down or suspended. */
  down: z.boolean(),
});

export type ModerationSubject = z.infer<typeof moderationSubjectSchema>;

/**
 * Every open report about one item, as the admin queue shows it.
 */
export const openReportGroupSchema = z.object({
  targetType: moderationTargetSchema,
  targetId: z.guid(),
  /** Null once the item is gone for good. */
  subject: moderationSubjectSchema.nullable(),
  reports: z.number().int(),
  reasons: z.array(reportReasonSchema),
  firstReportedAt: timestampSchema,
});

export type OpenReportGroup = z.infer<typeof openReportGroupSchema>;

export const moderationCaseSchema = z.object({
  /** Null once the item is gone for good, as a deleted comment is. */
  subject: moderationSubjectSchema.nullable(),
  reports: z.array(reportSchema),
  actions: z.array(moderationActionSchema),
  openContest: copyrightContestSchema.nullable(),
});

export type ModerationCase = z.infer<typeof moderationCaseSchema>;

/**
 * What a takedown refunded. Refunds Stripe refused are listed to follow up
 * by hand.
 */
export const moderationOutcomeSchema = z.object({
  refunded: z.number().int(),
  failedRefunds: z.array(z.string()),
});

export type ModerationOutcome = z.infer<typeof moderationOutcomeSchema>;

const noteSchema = z.string().nullable().optional();

export const reportRequestSchema = z.object({
  targetType: moderationTargetSchema,
  targetId: z.guid(),
  reason: reportReasonSchema,
  note: noteSchema,
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

export const contestRequestSchema = z.object({ statement: z.string() });

export const decisionRequestSchema = z.object({
  reason: reportReasonSchema,
  /** Sent to the people affected. */
  note: noteSchema,
});

export type DecisionRequest = z.infer<typeof decisionRequestSchema>;

export const noteRequestSchema = z.object({ note: noteSchema });

export const copyrightClaimRequestSchema = z.object({
  claimantName: z.string(),
  claimantEmail: z.string(),
  releaseId: z.guid(),
  note: noteSchema,
});

export type CopyrightClaimRequest = z.infer<typeof copyrightClaimRequestSchema>;

export const contestDecisionRequestSchema = z.object({
  outcome: z.enum(['upheld', 'rejected']),
  note: noteSchema,
});

export const queueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const openBillingPeriodRequestSchema = z.object({
  /** The first day of the month, `YYYY-MM-01`. */
  month: z.string(),
  storageMicrodollarsPerGbMonth: z.number().int(),
  requestMicrodollarsPerMillion: z.number().int(),
});

export type OpenBillingPeriodRequest = z.infer<
  typeof openBillingPeriodRequestSchema
>;

export const platformCostRequestSchema = z.object({
  category: z.enum([
    'storage_and_delivery',
    'hosting',
    'database',
    'other_services',
    'ownership_guarantee',
  ]),
  description: z.string(),
  /** In USD cents. */
  amount: z.number().int(),
});

export type PlatformCostRequest = z.infer<typeof platformCostRequestSchema>;

/**
 * What closing a month did.
 */
export const closeSummarySchema = z.object({
  sellers: z.number().int(),
  sharedCostsTotal: z.number().int(),
  sharedPerSeller: z.number().int(),
  subsidyTotal: z.number().int(),
  autoTopUps: z.number().int(),
  lapsed: z.number().int(),
  /** Sellers whose follow-up failed and needs a look. */
  failures: z.array(z.string()),
});

export type CloseSummary = z.infer<typeof closeSummarySchema>;

export const moderationContracts = {
  [ApiRoute.Reports]: {
    [HttpMethod.Post]: { request: reportRequestSchema, response: reportSchema },
  },
  [ApiRoute.ReleaseContest]: {
    [HttpMethod.Post]: {
      request: contestRequestSchema,
      response: copyrightContestSchema,
    },
  },
  [ApiRoute.AdminReports]: {
    [HttpMethod.Get]: {
      query: queueQuerySchema,
      response: z.array(openReportGroupSchema),
    },
  },
  [ApiRoute.AdminCase]: {
    [HttpMethod.Get]: { response: moderationCaseSchema },
  },
  [ApiRoute.AdminCaseDismiss]: {
    [HttpMethod.Post]: { request: noteRequestSchema, response: ackSchema },
  },
  [ApiRoute.AdminCaseTakeDown]: {
    [HttpMethod.Post]: {
      request: decisionRequestSchema,
      response: moderationOutcomeSchema,
    },
  },
  [ApiRoute.AdminCaseRestore]: {
    [HttpMethod.Post]: { request: noteRequestSchema, response: ackSchema },
  },
  [ApiRoute.AdminClearProfile]: {
    [HttpMethod.Post]: { request: decisionRequestSchema, response: ackSchema },
  },
  [ApiRoute.AdminCopyrightClaims]: {
    [HttpMethod.Post]: {
      request: copyrightClaimRequestSchema,
      response: reportSchema,
    },
  },
  [ApiRoute.AdminContestDecision]: {
    [HttpMethod.Post]: {
      request: contestDecisionRequestSchema,
      response: moderationOutcomeSchema,
    },
  },
  [ApiRoute.AdminBillingPeriods]: {
    [HttpMethod.Post]: {
      request: openBillingPeriodRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.AdminBillingPeriodCosts]: {
    [HttpMethod.Post]: {
      request: platformCostRequestSchema,
      response: ackSchema,
    },
  },
  [ApiRoute.AdminBillingPeriodClose]: {
    [HttpMethod.Post]: { response: closeSummarySchema },
  },
} as const satisfies Partial<Record<ApiRoute, RouteContracts>>;
