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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
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
  const itemAmount = Math.max(0, Number(amount) || 0)
  const config = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.NGN
  const actualFee = Math.round(itemAmount * 0.015 * 100) / 100
  const buyerFee = feePayer === 'buyer'
    ? actualFee
    : feePayer === 'split'
      ? Math.floor(actualFee * 100 / 2) / 100
      : 0
  const sellerFee = actualFee - buyerFee

  return {
    itemAmount,
    actualFee,
    buyerFee,
    sellerFee,
    total: itemAmount + buyerFee,
    currencySymbol: config.symbol,
    currencyCode: config.code,
  }
}
