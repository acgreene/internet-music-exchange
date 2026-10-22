import type { ReportReason } from '@ime/db';
import { formatMoney } from '@ime/utils';
import type { Email } from './email-service';

const REASONS: Record<ReportReason, string> = {
  hate_or_harassment: 'hate or harassment',
  copyright: 'a copyright claim',
  illegal_content: 'illegal content',
  harmful_design_code: 'harmful design code',
  spam: 'spam',
  other: "breaking IME's rules",
};

/**
 * Why, in the admin's words when they gave any.
 *
 * @param what - How the sentence opens, such as `It was removed`.
 */
const why = (what: string, reason: ReportReason, note: string | null) =>
  `${what} for ${REASONS[reason]}.${note ? `\n\n${note}` : ''}`;

/**
 * The emails moderation sends. Each says what was removed and why.
 */
export const moderationEmails = {
  takenDown(
    to: string,
    what: string,
    reason: ReportReason,
    note: string | null,
    contest: { url: string; days: number } | null,
  ): Email {
    return {
      to,
      subject: `${what} was taken down on IME`,
      text: `${what} was taken down by IME's admins. ${why('It was removed', reason, note)}${
        contest
          ? `\n\nIf you hold the rights, you can contest the claim within ${contest.days} days. Until then its files are kept, so it can be restored: ${contest.url}`
          : ''
      }`,
    };
  },

  restored(to: string, what: string): Email {
    return {
      to,
      subject: `${what} is back on IME`,
      text: `${what} has been restored after review.`,
    };
  },

  contestRejected(to: string, title: string): Email {
    return {
      to,
      subject: `Your contest for ${title} was not upheld`,
      text: `IME's admins reviewed your contest and the copyright takedown of ${title} stands. The release's files will be deleted and its buyers refunded.`,
    };
  },

  releaseRemovedFromLibrary(
    to: string,
    title: string,
    artistName: string,
    refund: { amount: number; currency: string } | null,
  ): Email {
    return {
      to,
      subject: `${title} was removed from your library`,
      text: `${title} by ${artistName} was taken down for breaking IME's rules and is no longer in your library.${
        refund
          ? ` Your ${formatMoney(refund.amount, refund.currency)} has been refunded to your payment method.`
          : ''
      }`,
    };
  },

  orderLineRefunded(
    to: string,
    name: string,
    amount: number,
    currency: string,
  ): Email {
    return {
      to,
      subject: `${name} was refunded`,
      text: `${name} was taken down for breaking IME's rules before it shipped, so it will not be sent. ${formatMoney(amount, currency)} has been refunded to your payment method. Anything else in your order is unaffected.`,
    };
  },

  designRemoved(
    to: string,
    designName: string,
    releaseTitles: string[],
  ): Email {
    return {
      to,
      subject: `The design ${designName} was taken down`,
      text: `The page design ${designName} was taken down for breaking IME's rules, so these releases now show the default layout:\n\n${releaseTitles.map((title) => `- ${title}`).join('\n')}\n\nYou can apply another design any time. If you paid for it, you have been refunded.`,
    };
  },

  suspended(
    to: string,
    what: string,
    reason: ReportReason,
    note: string | null,
  ): Email {
    return {
      to,
      subject: `${what} was suspended on IME`,
      text: `${what} was suspended by IME's admins. ${why('It was suspended', reason, note)}`,
    };
  },

  profileCleared(to: string, reason: ReportReason, note: string | null): Email {
    return {
      to,
      subject: 'Choose a new name on IME',
      text: `IME's admins cleared your username and display name. ${why('They were removed', reason, note)}\n\nPick new ones the next time you sign in.`,
    };
  },
};
