import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SentEmail {
  to: string;
  subject: string;
  html: string;
  sentAt: Date;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey: string;
  private readonly from: string;
  private readonly devOutbox: SentEmail[] = [];

  constructor(private readonly config: ConfigService) {
    this.resendApiKey = this.config.get<string>('email.resendApiKey') ?? '';
    this.from = this.config.getOrThrow<string>('email.from');
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const email: SentEmail = { to, subject, html, sentAt: new Date() };

    if (!this.resendApiKey) {
      this.devOutbox.push(email);
      this.logger.warn(
        { to, subject },
        'RESEND_API_KEY not set — captured email in dev outbox',
      );
      this.logger.debug(html);
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend send failed: ${res.status} ${body}`);
    }
  }

  /** For E2E tests: drain emails sent during a test run. */
  drainDevOutbox(): SentEmail[] {
    return this.devOutbox.splice(0, this.devOutbox.length);
  }

  peekDevOutbox(): SentEmail[] {
    return [...this.devOutbox];
  }
}
