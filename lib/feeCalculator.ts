export interface CurrencyConfig {
  code: string
  symbol: string
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  NGN: { code: 'NGN', symbol: '₦' },
  USD: { code: 'USD', symbol: '$' },
  GBP: { code: 'GBP', symbol: '£' },
  EUR: { code: 'EUR', symbol: '€' },
  GHS: { code: 'GHS', symbol: '₵' },
  KES: { code: 'KES', symbol: 'KSh' },
}

export function formatCurrency(amount: number, currencyCode: string = 'NGN'): string {
  const config = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.NGN
  const safeAmount = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount)
}

export interface FeeBreakdown {
  itemAmount: number
  actualFee: number
  buyerFee: number
  sellerFee: number
  total: number
  currencySymbol: string
  currencyCode: string
}

export function calculateEscrowFee(
  amount: number,
  currencyCode: string = 'NGN',
  feePayer: 'buyer' | 'seller' | 'split' = 'buyer'
): FeeBreakdown {
  const parsedAmount = Number(amount)
  const itemAmount = Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0
  const config = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.NGN
  const actualFee = Math.round(itemAmount * 0.015 * 100) / 100
  const normalizedFeePayer = feePayer === 'buyer' || feePayer === 'seller' || feePayer === 'split'
    ? feePayer
    : 'buyer'
  const buyerFee = normalizedFeePayer === 'buyer'
    ? actualFee
    : normalizedFeePayer === 'split'
      ? Math.floor(actualFee * 100 / 2) / 100
      : 0
  const sellerFee = actualFee - buyerFee

  return {
    itemAmount,
    actualFee,
    buyerFee,
    sellerFee,
    total: Math.round((itemAmount + buyerFee) * 100) / 100,
    currencySymbol: config.symbol,
    currencyCode: config.code,
  }
}

export function normalizeEscrowFees(
  amount: unknown,
  currencyCode: unknown,
  feePayer: unknown,
  storedFees: { platformFee?: unknown; buyerFee?: unknown; sellerFee?: unknown } = {},
): FeeBreakdown {
  const payer = feePayer === 'buyer' || feePayer === 'seller' || feePayer === 'split'
    ? feePayer
    : 'buyer';
  const currency = typeof currencyCode === 'string' ? currencyCode : 'NGN';
  const parsedAmount = amount === null || amount === undefined ? Number.NaN : Number(amount);
  const calculated = calculateEscrowFee(
    Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0,
    currency,
    payer,
  );
  const readStoredFee = (value: unknown, fallback: number) => {
    if (value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  const actualFee = readStoredFee(storedFees.platformFee, calculated.actualFee);
  const buyerFee = readStoredFee(storedFees.buyerFee, calculated.buyerFee);
  const sellerFee = readStoredFee(storedFees.sellerFee, calculated.sellerFee);

  return {
    ...calculated,
    actualFee,
    buyerFee,
    sellerFee,
    total: Math.round((calculated.itemAmount + buyerFee) * 100) / 100,
  };
}
