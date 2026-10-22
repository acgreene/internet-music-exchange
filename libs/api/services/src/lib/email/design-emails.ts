import type { Email } from './email-service';

/**
 * The emails the design gallery sends.
 */
export const designEmails = {
  /** A request for a custom design, passed on to the designer. */
  commissionRequest(
    to: string,
    replyTo: string,
    from: string,
    designName: string,
    message: string,
  ): Email {
    return {
      to,
      replyTo,
      subject: `${from} would like a custom design`,
      text: `${from} saw ${designName} in IME's design gallery and asked for a custom design:\n\n${message}\n\nReply to this email to answer them. IME takes no part in commissions: you arrange the work and payment between you, and deliver it as a private design granted to their artist.`,
    };
  },
};
