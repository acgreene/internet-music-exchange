import type { Email } from './email-service';
import { formatMoney } from '@ime/utils';

/** Funding is always in US dollars. */
const dollars = (cents: number) => formatMoney(cents, 'usd');

/**
 * The emails funding sends. Plain and practical: what happened, what it
 * means, and what to do.
 */
export const fundingEmails = {
  giftThanks(
    to: string,
    gift: {
      parts: { platform: number; developers: number };
      thanksName: string | null;
      monthly: boolean;
      costsUrl: string;
    },
  ): Email {
    const { platform, developers } = gift.parts;
    const every = gift.monthly ? ' a month' : '';
    const lines = [
      `Thank you for giving ${dollars(platform + developers)}${every} to IME.`,
      platform && developers
        ? `${dollars(platform)} goes to IME's hosting and ${dollars(developers)} to its developers, as you chose.`
        : null,
      platform
        ? `What goes to hosting pays real bills and lowers every seller's share. You can see where it goes: ${gift.costsUrl}`
        : null,
      gift.thanksName
        ? `You're on this month's thank-you list as ${gift.thanksName}.`
        : null,
    ];
    return {
      to,
      subject: 'Thank you for supporting IME',
      text: lines.filter(Boolean).join('\n\n'),
    };
  },

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
