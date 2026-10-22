import type { ModerationTarget, ReportReason } from '@ime/models';

const REASON_LABELS: Record<ReportReason, string> = {
  hate_or_harassment: 'Hate or harassment',
  copyright: 'Copyright infringement',
  illegal_content: 'Illegal content',
  harmful_design_code: 'Harmful design code',
  spam: 'Spam',
  other: 'Something else',
};

const TARGET_LABELS: Record<ModerationTarget, string> = {
  release: 'Release',
  product: 'Merch',
  comment: 'Comment',
  design: 'Page design',
  artist: 'Artist',
  user: 'User',
};

export function reportReasonLabel(reason: ReportReason): string {
  return REASON_LABELS[reason];
}

export function moderationTargetLabel(target: ModerationTarget): string {
  return TARGET_LABELS[target];
}

/**
 * The reasons that fit what is reported: only designs run code, and
 * copyright covers what someone made.
 */
export function reportReasonsFor(target: ModerationTarget): ReportReason[] {
  return (Object.keys(REASON_LABELS) as ReportReason[]).filter((reason) => {
    if (reason === 'harmful_design_code') return target === 'design';
    if (reason === 'copyright')
      return target !== 'user' && target !== 'comment';
    return true;
  });
}
