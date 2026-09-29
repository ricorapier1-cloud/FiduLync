export interface CurrencyConfig {
  code: string
  symbol: string
  maxFee: number
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  NGN: { code: 'NGN', symbol: '₦', maxFee: 5000 },
  USD: { code: 'USD', symbol: '$', maxFee: 10 },
  GBP: { code: 'GBP', symbol: '£', maxFee: 8 },
  EUR: { code: 'EUR', symbol: '€', maxFee: 9 },
  GHS: { code: 'GHS', symbol: '₵', maxFee: 120 },
  KES: { code: 'KES', symbol: 'KSh', maxFee: 1300 },
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
  savings: number
  total: number
  isCapped: boolean
  isPromoActive: boolean
  currencySymbol: string
  currencyCode: string
}

export function calculateEscrowFee(
  amount: number,
  currencyCode: string = 'NGN',
  promoCode?: string
): FeeBreakdown {
  const itemAmount = Math.max(0, Number(amount) || 0)
  const config = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.NGN

  if (promoCode && promoCode.trim().toUpperCase() === 'PROMO3FREE') {
    return {
      itemAmount,
      actualFee: 0,
      savings: Math.min(itemAmount * 0.02, config.maxFee),
      total: itemAmount,
      isCapped: false,
      isPromoActive: true,
      currencySymbol: config.symbol,
      currencyCode: config.code,
    }
  }

  const rawFee = itemAmount * 0.02
  const isCapped = rawFee > config.maxFee
  const actualFee = isCapped ? config.maxFee : rawFee
  const savings = isCapped ? rawFee - config.maxFee : 0

  return {
    itemAmount,
    actualFee,
    savings,
    total: itemAmount + actualFee,
    isCapped,
    isPromoActive: false,
    currencySymbol: config.symbol,
    currencyCode: config.code,
  }
}
