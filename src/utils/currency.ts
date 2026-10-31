/**
 * PayPilot Centralized Currency Formatting and Detection Utility
 * Standardizes multi-currency formatting, symbols, and detection throughout the app.
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  label: string;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound', label: 'GBP (£) - British Pound' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', label: 'CAD (CA$) - Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', label: 'AUD (A$) - Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', label: 'JPY (¥) - Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', label: 'CHF - Swiss Franc' },
];

/**
 * Formats a numeric amount with the appropriate currency symbol and decimals.
 * Uses Intl.NumberFormat for locale-accurate output, with safe fallback.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currencyCode: string = 'USD'
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || '0')) || 0;
  const code = (currencyCode || 'USD').trim().toUpperCase();

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: code === 'JPY' ? 0 : 2,
      maximumFractionDigits: code === 'JPY' ? 0 : 2,
    }).format(num);
  } catch (_e) {
    // Fallback for custom or unrecognized ISO codes
    const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
    const symbol = found ? found.symbol : code;
    return `${symbol}${num.toFixed(code === 'JPY' ? 0 : 2)}`;
  }
}

/**
 * Returns the short display symbol for a given currency code.
 */
export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  const code = (currencyCode || 'USD').trim().toUpperCase();
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  if (found) return found.symbol;

  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).formatToParts(0);
    const currencyPart = parts.find((p) => p.type === 'currency');
    return currencyPart ? currencyPart.value : code;
  } catch {
    return code;
  }
}

/**
 * Deterministically detects explicit currency mentions in natural-language text.
 * Checks symbols and keywords, returning the normalized 3-letter ISO code or null.
 */
export function detectCurrencyFromText(text: string): string | null {
  if (!text) return null;

  // 1. Check distinct symbols (check multi-character or specific symbols first)
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  if (text.includes('¥')) return 'JPY';
  if (/C\$/i.test(text)) return 'CAD';
  if (/A\$/i.test(text)) return 'AUD';

  // 2. Check explicit words/codes with word boundaries
  // Euro
  if (/\b(euros?|eur)\b/i.test(text)) return 'EUR';
  // British Pound
  if (/\b(pounds?|gbp|quid)\b/i.test(text)) return 'GBP';
  // Japanese Yen
  if (/\b(yens?|jpy)\b/i.test(text)) return 'JPY';
  // Canadian Dollar
  if (/\b(canadian dollars?|cad)\b/i.test(text)) return 'CAD';
  // Australian Dollar
  if (/\b(australian dollars?|aud)\b/i.test(text)) return 'AUD';
  // Swiss Franc
  if (/\b(swiss francs?|chf)\b/i.test(text)) return 'CHF';
  // US Dollar / general Dollar
  if (/\b(us dollars?|usd)\b/i.test(text)) return 'USD';
  if (text.includes('$') || /\b(dollars?)\b/i.test(text)) return 'USD';

  return null;
}
