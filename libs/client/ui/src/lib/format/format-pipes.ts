import { Pipe, type PipeTransform } from '@angular/core';
import { formatMoney } from '@ime/utils';

/**
 * Milliseconds as a running time, such as `3:07` or `1:02:45`. Unknown
 * lengths show as nothing.
 */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  public transform(ms: number | null | undefined): string {
    if (ms == null) return '';
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
      : `${minutes}:${seconds}`;
  }
}

/**
 * An amount in minor units with its currency, such as `$12.50`.
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  public transform(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }
}
