import { addMonths, addYears, differenceInCalendarDays } from "date-fns";

/**
 * Computes maturity date from start date and tenure
 */
export function calculateMaturityDate(
  startDate: Date | string,
  tenureValue: number,
  tenureUnit: "Months" | "Years"
): Date {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return new Date();
  }
  if (tenureUnit === "Years") {
    return addYears(start, tenureValue);
  } else {
    return addMonths(start, tenureValue);
  }
}

/**
 * Computes Lumpsum investment maturity value using compound/simple interest
 */
export function calculateLumpsumMaturity(
  principal: number,
  annualRatePercent: number,
  startDate: Date | string,
  maturityDate: Date | string,
  compoundingFrequency: "Monthly" | "Quarterly" | "Half-Yearly" | "Annually" | "At Maturity"
): number {
  const p = Number(principal) || 0;
  const r = (Number(annualRatePercent) || 0) / 100;
  const start = new Date(startDate);
  const end = new Date(maturityDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || p <= 0 || r <= 0) {
    return p;
  }

  // Calculate tenure t in decimal years
  const diffTime = end.getTime() - start.getTime();
  const t = diffTime / (365 * 24 * 60 * 60 * 1000);

  if (compoundingFrequency === "At Maturity") {
    // Simple Interest: A = P * (1 + r * t)
    const amount = p * (1 + r * t);
    return Math.round(amount * 100) / 100;
  }

  // Compound Interest: A = P * (1 + r/n)^(n * t)
  let n = 4; // default Quarterly
  if (compoundingFrequency === "Monthly") n = 12;
  else if (compoundingFrequency === "Quarterly") n = 4;
  else if (compoundingFrequency === "Half-Yearly") n = 2;
  else if (compoundingFrequency === "Annually") n = 1;

  const amount = p * Math.pow(1 + r / n, n * t);
  return Math.round(amount * 100) / 100;
}

/**
 * Simulates Recurring investment maturity value (RD/iWish) period-by-period
 */
export function calculateRecurringMaturity(
  installmentAmount: number,
  annualRatePercent: number,
  installmentFrequency: "Monthly" | "Quarterly",
  totalInstallments: number
): number {
  const p = Number(installmentAmount) || 0;
  const r = (Number(annualRatePercent) || 0) / 100;
  const installments = Number(totalInstallments) || 0;

  if (p <= 0 || r <= 0 || installments <= 0) {
    return p * installments;
  }

  const periodsPerYear = installmentFrequency === "Quarterly" ? 4 : 12;
  const ratePerPeriod = r / periodsPerYear;

  let balance = 0;
  for (let i = 0; i < installments; i++) {
    balance += p;
    balance += balance * ratePerPeriod;
  }

  return Math.round(balance * 100) / 100;
}

/**
 * Computes calendar days from today to maturity
 */
export function daysToMaturity(maturityDate: Date | string): number {
  if (!maturityDate) return 0;
  const end = new Date(maturityDate);
  if (Number.isNaN(end.getTime())) return 0;
  
  // Calculate calendar days difference (ignores time of day)
  return differenceInCalendarDays(end, new Date());
}

/**
 * Computes percentage progress through the tenure (0-100)
 */
export function tenureProgressPercent(
  startDate: Date | string,
  maturityDate: Date | string
): number {
  const start = new Date(startDate).getTime();
  const end = new Date(maturityDate).getTime();
  const now = new Date().getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 100;
  }

  if (now <= start) return 0;
  if (now >= end) return 100;

  const progress = ((now - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, Math.round(progress * 10) / 10));
}
