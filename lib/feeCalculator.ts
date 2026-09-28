export function calculateEscrowFee(amount: number, feeRate: number = 0.015, maxCap: number = 5000) {
  const rawFee = amount * feeRate;
  const actualFee = Math.min(rawFee, maxCap);
  const savings = rawFee > maxCap ? rawFee - maxCap : 0;

  return {
    rawFee,
    actualFee,
    isCapped: rawFee > maxCap,
    savings,
    total: amount + actualFee,
  };
}
