// Utility functions for shift calculations and formatting

import { calculateShiftHours } from './date-utils'

export interface Shift {
  id: string
  employee_id: string
  shift_date: string
  start_time: string
  end_time: string
  position: string | null
  notes: string | null
}

/**
 * Calculate total hours from an array of shifts
 */
export function calculateTotalHours(shifts: Shift[]): number {
  return shifts.reduce((total, shift) => {
    const hours = calculateShiftHours(shift.start_time, shift.end_time)
    return total + hours
  }, 0)
}

/**
 * Get shifts for current week
 */
export function getWeekShifts(shifts: Shift[], weekStart: Date): Shift[] {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  return shifts.filter(shift => {
    const shiftDate = new Date(shift.shift_date)
    return shiftDate >= weekStart && shiftDate < weekEnd
  })
}

/**
 * Get upcoming shifts (future shifts only)
 */
export function getUpcomingShifts(shifts: Shift[]): Shift[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return shifts
    .filter(shift => new Date(shift.shift_date) >= today)
    .sort((a, b) => new Date(a.shift_date).getTime() - new Date(b.shift_date).getTime())
}

/**
 * Get next shift (soonest upcoming shift)
 */
export function getNextShift(shifts: Shift[]): Shift | null {
  const upcoming = getUpcomingShifts(shifts)
  return upcoming.length > 0 ? upcoming[0] : null
}

/**
 * Get past shifts (historical shifts)
 */
export function getPastShifts(shifts: Shift[]): Shift[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return shifts
    .filter(shift => new Date(shift.shift_date) < today)
    .sort((a, b) => new Date(b.shift_date).getTime() - new Date(a.shift_date).getTime())
}

/**
 * Get this week's total hours for an employee
 */
export function getThisWeekHours(shifts: Shift[]): number {
  const today = new Date()
  const weekStart = new Date(today)
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  weekStart.setDate(diff)
  weekStart.setHours(0, 0, 0, 0)

  const weekShifts = getWeekShifts(shifts, weekStart)
  return calculateTotalHours(weekShifts)
}

/**
 * Group shifts by date
 */
export function groupShiftsByDate(shifts: Shift[]): Record<string, Shift[]> {
  return shifts.reduce((grouped, shift) => {
    const date = shift.shift_date
    if (!grouped[date]) {
      grouped[date] = []
    }
    grouped[date].push(shift)
    return grouped
  }, {} as Record<string, Shift[]>)
}

/**
 * Check if a shift is today
 */
export function isShiftToday(shift: Shift): boolean {
  const today = new Date()
  const shiftDate = new Date(shift.shift_date)
  return (
    today.getDate() === shiftDate.getDate() &&
    today.getMonth() === shiftDate.getMonth() &&
    today.getFullYear() === shiftDate.getFullYear()
  )
}

/**
 * Check if a shift is this week
 */
export function isShiftThisWeek(shift: Shift): boolean {
  const today = new Date()
  const weekStart = new Date(today)
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  weekStart.setDate(diff)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const shiftDate = new Date(shift.shift_date)
  return shiftDate >= weekStart && shiftDate < weekEnd
}
