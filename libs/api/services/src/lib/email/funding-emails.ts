import type { Email } from './email-service';

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * The emails funding sends. Plain and practical: what happened, what it
 * means, and what to do.
 */
export const fundingEmails = {
  lowBalance(to: string, balance: number, billingUrl: string): Email {
    return {
      to,
      subject: 'Your IME hosting balance is running low',
      text: `Your hosting balance is down to ${dollars(balance)}, below the alert you set.\n\nTop up any time: ${billingUrl}`,
    };
  },

  balanceLapsed(
    to: string,
    balance: number,
    graceDays: number,
    billingUrl: string,
  ): Email {
    return {
      to,
      subject: 'Your IME hosting balance is below zero',
      text: `This month's hosting share left your balance at ${dollars(balance)}, and it could not be topped up automatically.\n\nTop up within ${graceDays} days to keep everything you pay for on sale: ${billingUrl}\n\nListeners keep what they already own either way.`,
    };
  },

  lapseWarning(to: string, daysLeft: number, billingUrl: string): Email {
    return {
      to,
      subject: `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to top up your IME balance`,
      text: `Your hosting balance is still below zero. In ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}, the music, merch, and designs you pay for come off sale and uploads pause.\n\nTop up to keep them on sale: ${billingUrl}`,
    };
  },

  offSale(to: string, name: string, billingUrl: string): Email {
    return {
      to,
      subject: `${name} is off sale on IME`,
      text: `The hosting costs for ${name} went unpaid, so it is off sale and uploads are paused. Listeners keep what they already own.\n\nPaying what is owed and topping up puts everything back on sale: ${billingUrl}\n\nIf nothing is paid within 90 days, files nobody owns are deleted.`,
    };
  },
};
