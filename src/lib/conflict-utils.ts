import { Shift } from './database.types'
import { isSameDay, parseISO } from 'date-fns'

/**
 * Check if two time ranges overlap
 */
export function hasTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  // Convert time strings to minutes since midnight for easier comparison
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  let start1Minutes = timeToMinutes(start1)
  let end1Minutes = timeToMinutes(end1)
  let start2Minutes = timeToMinutes(start2)
  let end2Minutes = timeToMinutes(end2)

  // Handle overnight shifts (end time is earlier than start time)
  if (end1Minutes < start1Minutes) {
    end1Minutes += 24 * 60 // Add 24 hours
  }
  if (end2Minutes < start2Minutes) {
    end2Minutes += 24 * 60 // Add 24 hours
  }

  // Check for overlap: Two ranges overlap if one starts before the other ends
  // and the other starts before the first ends
  return start1Minutes < end2Minutes && start2Minutes < end1Minutes
}

/**
 * Detect shift conflicts for a specific employee on a specific date
 */
export interface ShiftConflict {
  shift: Shift
  conflictType: 'time_overlap' | 'same_employee'
  message: string
}

export function detectShiftConflicts(
  employeeId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  allShifts: Shift[],
  excludeShiftId?: string
): ShiftConflict[] {
  const conflicts: ShiftConflict[] = []

  // Filter shifts for the same employee on the same date
  const employeeShiftsOnDate = allShifts.filter(shift => {
    // Exclude the shift being edited/checked
    if (excludeShiftId && shift.id === excludeShiftId) {
      return false
    }

    // Check if it's the same employee and same date
    if (shift.employee_id !== employeeId) {
      return false
    }

    if (!shift.shift_date) {
      return false
    }

    try {
      return isSameDay(parseISO(shift.shift_date), parseISO(shiftDate))
    } catch {
      return false
    }
  })

  // Check each shift for time overlap
  employeeShiftsOnDate.forEach(existingShift => {
    if (hasTimeOverlap(startTime, endTime, existingShift.start_time, existingShift.end_time)) {
      conflicts.push({
        shift: existingShift,
        conflictType: 'time_overlap',
        message: `Time overlap with existing shift: ${existingShift.start_time} - ${existingShift.end_time}`
      })
    }
  })

  return conflicts
}

/**
 * Check if a specific shift has any conflicts
 */
export function hasConflicts(
  employeeId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  allShifts: Shift[],
  excludeShiftId?: string
): boolean {
  const conflicts = detectShiftConflicts(
    employeeId,
    shiftDate,
    startTime,
    endTime,
    allShifts,
    excludeShiftId
  )
  return conflicts.length > 0
}

/**
 * Get all conflicts for a set of shifts
 */
export function getAllShiftConflicts(shifts: Shift[]): Map<string, ShiftConflict[]> {
  const conflictMap = new Map<string, ShiftConflict[]>()

  shifts.forEach(shift => {
    const conflicts = detectShiftConflicts(
      shift.employee_id,
      shift.shift_date,
      shift.start_time,
      shift.end_time,
      shifts,
      shift.id
    )

    if (conflicts.length > 0) {
      conflictMap.set(shift.id, conflicts)
    }
  })

  return conflictMap
}

/**
 * Check if a shift is valid (no conflicts)
 */
export function isShiftValid(
  employeeId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  allShifts: Shift[],
  excludeShiftId?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check for time conflicts
  const conflicts = detectShiftConflicts(
    employeeId,
    shiftDate,
    startTime,
    endTime,
    allShifts,
    excludeShiftId
  )

  if (conflicts.length > 0) {
    conflicts.forEach(conflict => {
      errors.push(conflict.message)
    })
  }

  // Validate time format
  if (!startTime || !endTime) {
    errors.push('Start time and end time are required')
  }

  // Validate that start time is not the same as end time
  if (startTime === endTime) {
    errors.push('Start time cannot be the same as end time')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get conflict severity level
 */
export function getConflictSeverity(conflicts: ShiftConflict[]): 'none' | 'warning' | 'error' {
  if (conflicts.length === 0) {
    return 'none'
  }

  // If there are any time overlaps, it's an error
  if (conflicts.some(c => c.conflictType === 'time_overlap')) {
    return 'error'
  }

  return 'warning'
}

/**
 * Format conflict message for display
 */
export function formatConflictMessage(conflicts: ShiftConflict[]): string {
  if (conflicts.length === 0) {
    return ''
  }

  if (conflicts.length === 1) {
    return conflicts[0].message
  }

  return `${conflicts.length} conflicts detected:\n${conflicts.map(c => `• ${c.message}`).join('\n')}`
}
