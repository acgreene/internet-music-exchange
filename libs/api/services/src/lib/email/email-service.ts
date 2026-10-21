import { env } from '@ime/env';
import { Logger } from '@ime/utils';

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * One email to send.
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends transactional email through Resend. Without an API key, as while
 * developing, each email is written to the log instead.
 */
export class EmailService {
  private readonly log = new Logger('api').child('email');

  constructor(
    private readonly apiKey: string | undefined = env.RESEND_API_KEY,
    private readonly from: string = env.EMAIL_FROM,
  ) {}

  /**
   * Send one email.
   *
   * @throws When Resend refuses it.
   */
  public async send(email: Email): Promise<void> {
    if (!this.apiKey) {
      this.log.info(
        `(not sent, no RESEND_API_KEY) to ${email.to}: ${email.subject}\n${email.text}`,
      );
      return;
    }

    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, ...email }),
    });
    if (!response.ok) {
      throw new Error(
        `Resend refused an email (${response.status}): ${await response.text()}`,
      );
    }
  }
}
