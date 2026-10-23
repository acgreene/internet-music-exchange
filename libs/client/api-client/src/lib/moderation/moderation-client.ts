import {
  type AckResponse,
  ApiRoute,
  type CloseSummary,
  type CopyrightClaimRequest,
  type CopyrightContestResponse,
  type DecisionRequest,
  type ModerationCase,
  type ModerationOutcome,
  type ModerationTarget,
  type OpenBillingPeriodRequest,
  type OpenReportGroup,
  type PlatformCostRequest,
  type ReserveFundingRequest,
  type ReportRequest,
  type ReportResponse,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Reporting content and contesting takedowns, for everyone.
 */
export class ReportsClient {
  constructor(private readonly transport: ApiTransport) {}

  /**
   * Report something for an admin to review.
   */
  public report(report: ReportRequest): Promise<ApiResult<ReportResponse>> {
    return this.transport.post(ApiRoute.Reports, { body: report });
  }

  /**
   * Contest a copyright takedown of one of the artist's releases.
   */
  public contest(
    releaseId: string,
    statement: string,
  ): Promise<ApiResult<CopyrightContestResponse>> {
    return this.transport.post(ApiRoute.ReleaseContest, {
      params: { releaseId },
      body: { statement },
    });
  }
}

/**
 * The admin tools: the moderation queue, actions on reported items, and the
 * monthly billing close. Only platform admins may call these.
 */
export class AdminClient {
  constructor(private readonly transport: ApiTransport) {}

  /**
   * Items with open reports, longest waiting first.
   */
  public listQueue(limit?: number): Promise<ApiResult<OpenReportGroup[]>> {
    return this.transport.get(ApiRoute.AdminReports, { query: { limit } });
  }

  public getCase(
    targetType: ModerationTarget,
    targetId: string,
  ): Promise<ApiResult<ModerationCase>> {
    return this.transport.get(ApiRoute.AdminCase, {
      params: { targetType, targetId },
    });
  }

  public dismiss(
    targetType: ModerationTarget,
    targetId: string,
    note?: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.AdminCaseDismiss, {
      params: { targetType, targetId },
      body: { note },
    });
  }

  /**
   * Take an item down, or suspend an artist or user. The note is sent to the
   * people affected.
   */
  public takeDown(
    targetType: ModerationTarget,
    targetId: string,
    decision: DecisionRequest,
  ): Promise<ApiResult<ModerationOutcome>> {
    return this.transport.post(ApiRoute.AdminCaseTakeDown, {
      params: { targetType, targetId },
      body: decision,
    });
  }

  public restore(
    targetType: ModerationTarget,
    targetId: string,
    note?: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.AdminCaseRestore, {
      params: { targetType, targetId },
      body: { note },
    });
  }

  public clearProfile(
    userId: string,
    decision: DecisionRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.AdminClearProfile, {
      params: { userId },
      body: decision,
    });
  }

  public recordCopyrightClaim(
    claim: CopyrightClaimRequest,
  ): Promise<ApiResult<ReportResponse>> {
    return this.transport.post(ApiRoute.AdminCopyrightClaims, { body: claim });
  }

  public decideContest(
    releaseId: string,
    outcome: 'upheld' | 'rejected',
    note?: string,
  ): Promise<ApiResult<ModerationOutcome>> {
    return this.transport.post(ApiRoute.AdminContestDecision, {
      params: { releaseId },
      body: { outcome, note },
    });
  }

  public openBillingPeriod(
    period: OpenBillingPeriodRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.AdminBillingPeriods, { body: period });
  }

  public addPlatformCost(
    month: string,
    cost: PlatformCostRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.AdminBillingPeriodCosts, {
      params: { month },
      body: cost,
    });
  }

  /** Put IME's own money into the reserve. */
  public fundReserve(
    funding: ReserveFundingRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.AdminReserveFunding, { body: funding });
  }

  public closeBillingPeriod(month: string): Promise<ApiResult<CloseSummary>> {
    return this.transport.post(ApiRoute.AdminBillingPeriodClose, {
      params: { month },
    });
  }
}
