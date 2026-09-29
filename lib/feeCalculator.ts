export interface FeeBreakdown {
  itemAmount: number
  actualFee: number
  savings: number
  total: number
  isCapped: boolean
  isPromoActive: boolean
}

export function calculateEscrowFee(amount: number, promoCode?: string): FeeBreakdown {
  const itemAmount = Math.max(0, Number(amount) || 0)

  // Validate Promo Code
  if (promoCode && promoCode.trim().toUpperCase() === 'PROMO3FREE') {
    return {
      itemAmount,
      actualFee: 0,
      savings: Math.min(itemAmount * 0.02, 5000),
      total: itemAmount,
      isCapped: false,
      isPromoActive: true
    }
  }

  // Standard 2% Fee capped at ₦5,000
  const rawFee = itemAmount * 0.02
  const cappedFee = 5000
  const isCapped = rawFee > cappedFee
  const actualFee = isCapped ? cappedFee : rawFee
  const savings = isCapped ? rawFee - cappedFee : 0

  return {
    itemAmount,
    actualFee,
    savings,
    total: itemAmount + actualFee,
    isCapped,
    isPromoActive: false
  }
}
