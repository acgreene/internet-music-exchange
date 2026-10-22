/**
 * An amount in minor units as people read it, such as `$12.50` or `€8.00`.
 *
 * @param currency - ISO 4217, any case.
 */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
