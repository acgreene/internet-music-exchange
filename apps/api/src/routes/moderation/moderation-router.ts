import { ApiRoute, HttpMethod, moderationTargetSchema } from '@ime/models';
import type {
  ModerationService,
  ModerationTargetRef,
  MonthlyCloseService,
  ReportService,
} from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Moderation and the admin tools: reports and copyright contests from the
 * community, the admin queue and the actions taken on it, and the monthly
 * billing close.
 */
export class ModerationRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly reports: ReportService,
    private readonly moderation: ModerationService,
    private readonly monthlyClose: MonthlyCloseService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(HttpMethod.Post, ApiRoute.Reports, 'user', ({ userId, body }) =>
      this.reports.report(
        userId,
        { type: body.targetType, id: body.targetId },
        body.reason,
        body.note,
      ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.ReleaseContest,
      'user',
      ({ userId, params, body }) =>
        this.reports.contest(userId, params.releaseId, body.statement),
    );

    this.registerAdmin();
    this.registerMonthlyClose();
  }

  private registerAdmin(): void {
    this.handle(
      HttpMethod.Get,
      ApiRoute.AdminReports,
      'admin',
      ({ userId, query }) => this.moderation.listQueue(userId, query.limit),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.AdminCase,
      'admin',
      ({ userId, params }) =>
        this.moderation.getCase(userId, this.target(params)),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminCaseDismiss,
      'admin',
      ({ userId, params, body }) =>
        this.moderation.dismiss(userId, this.target(params), body.note),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminCaseTakeDown,
      'admin',
      ({ userId, params, body }) =>
        this.moderation.takeDown(userId, this.target(params), body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminCaseRestore,
      'admin',
      ({ userId, params, body }) =>
        this.moderation.restore(userId, this.target(params), body.note),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminClearProfile,
      'admin',
      ({ userId, params, body }) =>
        this.moderation.clearProfile(userId, params.userId, body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminCopyrightClaims,
      'admin',
      ({ userId, body }) => this.moderation.recordCopyrightClaim(userId, body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminContestDecision,
      'admin',
      ({ userId, params, body }) =>
        this.moderation.resolveContest(
          userId,
          params.releaseId,
          body.outcome,
          body.note,
        ),
    );
  }

  private registerMonthlyClose(): void {
    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminBillingPeriods,
      'admin',
      ({ userId, body }) =>
        this.monthlyClose.openMonth(userId, body.month, {
          storageMicrodollarsPerGbMonth: body.storageMicrodollarsPerGbMonth,
          requestMicrodollarsPerMillion: body.requestMicrodollarsPerMillion,
        }),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminBillingPeriodCosts,
      'admin',
      ({ userId, params, body }) =>
        this.monthlyClose.addCost(
          userId,
          params.month,
          body.category,
          body.description,
          body.amount,
        ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.AdminBillingPeriodClose,
      'admin',
      ({ userId, params }) =>
        this.monthlyClose.closeMonth(userId, params.month),
    );
  }

  private target(params: {
    targetType: string;
    targetId: string;
  }): ModerationTargetRef {
    return {
      type: this.enumParam(moderationTargetSchema.options, params.targetType),
      id: params.targetId,
    };
  }
}
