/**
 * Trinidad and Tobago Tax and Deduction Calculations
 * Based on 2024/2025 tax rates and regulations
 */

// NIS (National Insurance Scheme) Constants
export const NIS_EMPLOYEE_RATE = 0.042 // 4.2%
export const NIS_MONTHLY_CEILING = 6820 // TTD $6,820 monthly earnings ceiling
export const NIS_MAX_MONTHLY_DEDUCTION = NIS_MONTHLY_CEILING * NIS_EMPLOYEE_RATE // ~TTD $286.44

// PAYE (Pay As You Earn) Tax Brackets - Annual Basis
export const TAX_BRACKETS = {
  FIRST_BRACKET: {
    limit: 72000, // First TTD $72,000/year
    rate: 0 // 0% tax
  },
  SECOND_BRACKET: {
    limit: 1000000, // TTD $72,001 - $1,000,000/year
    rate: 0.25 // 25% tax
  },
  THIRD_BRACKET: {
    rate: 0.30 // 30% tax on income over $1,000,000/year
  }
}

/**
 * Calculate NIS (National Insurance) deduction
 * Employee contributes 4.2% on earnings up to monthly ceiling of TTD $6,820
 */
export function calculateNIS(grossMonthlyPay: number): number {
  if (!grossMonthlyPay || grossMonthlyPay <= 0) {
    return 0
  }

  // Apply ceiling - NIS only calculated on earnings up to $6,820/month
  const applicableEarnings = Math.min(grossMonthlyPay, NIS_MONTHLY_CEILING)

  // Calculate 4.2% of applicable earnings
  const nis = applicableEarnings * NIS_EMPLOYEE_RATE

  // Round to 2 decimal places
  return Math.round(nis * 100) / 100
}

/**
 * Calculate PAYE (Income Tax) deduction based on Trinidad tax brackets
 * Income is annualized first, then tax is calculated and divided by 12
 */
export function calculatePAYE(grossMonthlyPay: number): number {
  if (!grossMonthlyPay || grossMonthlyPay <= 0) {
    return 0
  }

  // Annualize the monthly income
  const annualIncome = grossMonthlyPay * 12

  let annualTax = 0

  // First bracket: $0 - $72,000 at 0%
  if (annualIncome <= TAX_BRACKETS.FIRST_BRACKET.limit) {
    annualTax = 0
  }
  // Second bracket: $72,001 - $1,000,000 at 25%
  else if (annualIncome <= TAX_BRACKETS.SECOND_BRACKET.limit) {
    const taxableIncome = annualIncome - TAX_BRACKETS.FIRST_BRACKET.limit
    annualTax = taxableIncome * TAX_BRACKETS.SECOND_BRACKET.rate
  }
  // Third bracket: Over $1,000,000 at 30%
  else {
    // First $72,000: no tax
    // Next $928,000 ($72,001 to $1,000,000): 25%
    const secondBracketTaxable = TAX_BRACKETS.SECOND_BRACKET.limit - TAX_BRACKETS.FIRST_BRACKET.limit
    const secondBracketTax = secondBracketTaxable * TAX_BRACKETS.SECOND_BRACKET.rate

    // Amount over $1,000,000: 30%
    const thirdBracketTaxable = annualIncome - TAX_BRACKETS.SECOND_BRACKET.limit
    const thirdBracketTax = thirdBracketTaxable * TAX_BRACKETS.THIRD_BRACKET.rate

    annualTax = secondBracketTax + thirdBracketTax
  }

  // Convert annual tax to monthly deduction
  const monthlyPAYE = annualTax / 12

  // Round to 2 decimal places
  return Math.round(monthlyPAYE * 100) / 100
}

/**
 * Calculate all deductions and net pay for a pay period
 */
export interface PayCalculation {
  grossPay: number
  nis: number
  paye: number
  totalDeductions: number
  netPay: number
}

export function calculateNetPay(grossMonthlyPay: number): PayCalculation {
  const grossPay = Math.round(grossMonthlyPay * 100) / 100
  const nis = calculateNIS(grossPay)
  const paye = calculatePAYE(grossPay)
  const totalDeductions = Math.round((nis + paye) * 100) / 100
  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100

  return {
    grossPay,
    nis,
    paye,
    totalDeductions,
    netPay
  }
}

/**
 * Format currency for Trinidad (TTD)
 */
export function formatTTD(amount: number): string {
  return `TTD $${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * Get effective tax rate (percentage of gross pay taken as tax)
 */
export function getEffectiveTaxRate(grossMonthlyPay: number): number {
  if (!grossMonthlyPay || grossMonthlyPay <= 0) return 0

  const paye = calculatePAYE(grossMonthlyPay)
  const rate = (paye / grossMonthlyPay) * 100

  return Math.round(rate * 100) / 100
}

/**
 * Get tax bracket description for a given monthly income
 */
export function getTaxBracket(grossMonthlyPay: number): string {
  const annualIncome = grossMonthlyPay * 12

  if (annualIncome <= TAX_BRACKETS.FIRST_BRACKET.limit) {
    return 'Tax-Free (Annual income ≤ $72,000)'
  } else if (annualIncome <= TAX_BRACKETS.SECOND_BRACKET.limit) {
    return '25% Tax Bracket (Annual income $72,001 - $1,000,000)'
  } else {
    return '30% Tax Bracket (Annual income > $1,000,000)'
  }
}
