import { Shift } from './database.types'
import { calculateShiftHours } from './date-utils'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'

/**
 * Calculate gross pay based on hours worked and hourly rate
 */
export function calculateGrossPay(hours: number, hourlyRate: number): number {
  if (!hours || !hourlyRate || hours < 0 || hourlyRate < 0) {
    return 0
  }
  return hours * hourlyRate
}

/**
 * Get total hours worked by an employee for a specific period
 */
export function getEmployeeHoursForPeriod(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  shifts: Shift[]
): number {
  if (!employeeId || !shifts || shifts.length === 0) {
    return 0
  }

  const employeeShifts = shifts.filter(shift =>
    shift.employee_id === employeeId &&
    shift.shift_date &&
    isWithinInterval(parseISO(shift.shift_date), { start: startDate, end: endDate })
  )

  const totalHours = employeeShifts.reduce((total, shift) => {
    const hours = calculateShiftHours(shift.start_time, shift.end_time)
    return total + hours
  }, 0)

  return totalHours
}

/**
 * Get total pay for an employee for a specific period
 */
export function getEmployeePayForPeriod(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  shifts: Shift[],
  hourlyRate: number
): number {
  const hours = getEmployeeHoursForPeriod(employeeId, startDate, endDate, shifts)
  return calculateGrossPay(hours, hourlyRate)
}

/**
 * Get this week's hours for an employee
 */
export function getThisWeekHours(employeeId: string, shifts: Shift[]): number {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  return getEmployeeHoursForPeriod(employeeId, weekStart, weekEnd, shifts)
}

/**
 * Get this week's pay for an employee
 */
export function getThisWeekPay(employeeId: string, shifts: Shift[], hourlyRate: number): number {
  const hours = getThisWeekHours(employeeId, shifts)
  return calculateGrossPay(hours, hourlyRate)
}

/**
 * Get this month's hours for an employee
 */
export function getThisMonthHours(employeeId: string, shifts: Shift[]): number {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  return getEmployeeHoursForPeriod(employeeId, monthStart, monthEnd, shifts)
}

/**
 * Get this month's pay for an employee
 */
export function getThisMonthPay(employeeId: string, shifts: Shift[], hourlyRate: number): number {
  const hours = getThisMonthHours(employeeId, shifts)
  return calculateGrossPay(hours, hourlyRate)
}

/**
 * Get all-time hours for an employee
 */
export function getAllTimeHours(employeeId: string, shifts: Shift[]): number {
  if (!employeeId || !shifts || shifts.length === 0) {
    return 0
  }

  const employeeShifts = shifts.filter(shift => shift.employee_id === employeeId)

  const totalHours = employeeShifts.reduce((total, shift) => {
    const hours = calculateShiftHours(shift.start_time, shift.end_time)
    return total + hours
  }, 0)

  return totalHours
}

/**
 * Get payroll summary for an employee
 */
export interface PayrollSummary {
  thisWeek: {
    hours: number
    pay: number
  }
  thisMonth: {
    hours: number
    pay: number
  }
  allTime: {
    hours: number
    pay: number
  }
}

export function getPayrollSummary(
  employeeId: string,
  shifts: Shift[],
  hourlyRate: number
): PayrollSummary {
  const thisWeekHours = getThisWeekHours(employeeId, shifts)
  const thisMonthHours = getThisMonthHours(employeeId, shifts)
  const allTimeHours = getAllTimeHours(employeeId, shifts)

  return {
    thisWeek: {
      hours: thisWeekHours,
      pay: calculateGrossPay(thisWeekHours, hourlyRate)
    },
    thisMonth: {
      hours: thisMonthHours,
      pay: calculateGrossPay(thisMonthHours, hourlyRate)
    },
    allTime: {
      hours: allTimeHours,
      pay: calculateGrossPay(allTimeHours, hourlyRate)
    }
  }
}

/**
 * Calculate total labor cost for all shifts in a given period
 */
export function calculateLaborCost(
  shifts: Shift[],
  employeeRates: Map<string, number>
): number {
  if (!shifts || shifts.length === 0) {
    return 0
  }

  const totalCost = shifts.reduce((total, shift) => {
    const hours = calculateShiftHours(shift.start_time, shift.end_time)
    const rate = employeeRates.get(shift.employee_id) || 0
    return total + calculateGrossPay(hours, rate)
  }, 0)

  return totalCost
}
