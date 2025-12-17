import { format, formatDistance, parseISO, isValid } from 'date-fns';

/**
 * Format a date string for display
 */
export function formatDate(date: string | Date | null | undefined, formatStr: string = 'MMM d, yyyy'): string {
  if (!date) return '-';

  try {
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(parsed)) return '-';
    return format(parsed, formatStr);
  } catch {
    return '-';
  }
}

/**
 * Format a date as relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';

  try {
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(parsed)) return '-';
    return formatDistance(parsed, new Date(), { addSuffix: true });
  } catch {
    return '-';
  }
}

/**
 * Format a date for datetime display
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, 'MMM d, yyyy h:mm a');
}

/**
 * Format currency
 */
export function formatCurrency(
  amount: number | string,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(numericAmount);
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number | string, decimals: number = 0): string {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numericValue);
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number | string, decimals: number = 1): string {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  return `${numericValue.toFixed(decimals)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
