// Trinidad-specific date and time utilities
// Always use DD/MM/YYYY format and 12-hour time with am/pm

/**
 * Format date in Trinidad standard: DD/MM/YYYY
 */
export function formatDateTrinidad(date: Date | string): string {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Format time in 12-hour format with am/pm
 */
export function formatTimeTrinidad(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes}${ampm}`
}

/**
 * Parse DD/MM/YYYY format to Date object
 */
export function parseTrinidadDate(dateString: string): Date {
  const [day, month, year] = dateString.split('/')
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

/**
 * Get current date in Trinidad timezone
 */
export function getCurrentDateTrinidad(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Port_of_Spain' }))
}

/**
 * Format currency in TTD
 */
export function formatCurrencyTTD(amount: number): string {
  return `$${amount.toFixed(2)} TTD`
}

/**
 * Convert 12-hour time to 24-hour format for database storage
 */
export function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(/(\w+)/)
  let [hours, minutes] = time.split(':')

  if (hours === '12') {
    hours = '00'
  }

  if (modifier.toLowerCase() === 'pm') {
    hours = String(parseInt(hours, 10) + 12)
  }

  return `${hours}:${minutes}`
}

/**
 * Get week start (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(d.setDate(diff))
}

/**
 * Get week end (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  return weekEnd
}

/**
 * Get days of the week starting from Monday
 */
export function getWeekDays(startDate: Date): Date[] {
  const days = []
  const current = new Date(startDate)

  for (let i = 0; i < 7; i++) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return days
}

/**
 * Check if a date is a Caribbean holiday
 */
export function isCaribbeenHoliday(date: Date): { isHoliday: boolean; reason?: string } {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  // Fixed holidays
  const holidays = [
    { month: 1, day: 1, reason: 'New Year\'s Day' },
    { month: 8, day: 1, reason: 'Emancipation Day' },
    { month: 8, day: 31, reason: 'Independence Day' },
    { month: 12, day: 25, reason: 'Christmas Day' },
    { month: 12, day: 26, reason: 'Boxing Day' },
  ]

  // Carnival 2025 dates (February 24-25)
  if (year === 2025 && month === 2 && (day === 24 || day === 25)) {
    return { isHoliday: true, reason: day === 24 ? 'Carnival Monday' : 'Carnival Tuesday' }
  }

  // Check fixed holidays
  for (const holiday of holidays) {
    if (month === holiday.month && day === holiday.day) {
      return { isHoliday: true, reason: holiday.reason }
    }
  }

  return { isHoliday: false }
}

/**
 * Get common shift times for Trinidad restaurants
 */
export function getCommonShiftTimes(): Array<{ label: string; start: string; end: string }> {
  return [
    { label: 'Lunch Shift', start: '10:00', end: '15:00' },
    { label: 'Dinner Shift', start: '17:00', end: '23:00' },
    { label: 'Full Day', start: '09:00', end: '17:00' },
    { label: 'Morning', start: '06:00', end: '14:00' },
    { label: 'Evening', start: '14:00', end: '22:00' },
    { label: 'Late Night', start: '22:00', end: '02:00' },
  ]
}

/**
 * Calculate shift duration in hours
 */
export function calculateShiftHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) {
    return 0
  }

  // Ensure time is in HH:MM format by removing seconds if present
  const cleanStartTime = startTime.substring(0, 5)
  const cleanEndTime = endTime.substring(0, 5)

  // Add seconds if not present
  const startTimeWithSeconds = cleanStartTime.includes(':') && cleanStartTime.split(':').length === 2
    ? `${cleanStartTime}:00`
    : cleanStartTime
  const endTimeWithSeconds = cleanEndTime.includes(':') && cleanEndTime.split(':').length === 2
    ? `${cleanEndTime}:00`
    : cleanEndTime

  const start = new Date(`2000-01-01T${startTimeWithSeconds}`)
  let end = new Date(`2000-01-01T${endTimeWithSeconds}`)

  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid time format:', { startTime, endTime })
    return 0
  }

  // Handle overnight shifts
  if (end < start) {
    end = new Date(`2000-01-02T${endTimeWithSeconds}`)
  }

  const diffMs = end.getTime() - start.getTime()
  const hours = diffMs / (1000 * 60 * 60) // Convert to hours

  return isNaN(hours) ? 0 : hours
}

/**
 * Check for shift time overlap
 */
export function hasTimeOverlap(
  shift1Start: string,
  shift1End: string,
  shift2Start: string,
  shift2End: string
): boolean {
  const start1 = new Date(`2000-01-01T${shift1Start}:00`)
  let end1 = new Date(`2000-01-01T${shift1End}:00`)
  const start2 = new Date(`2000-01-01T${shift2Start}:00`)
  let end2 = new Date(`2000-01-01T${shift2End}:00`)

  // Handle overnight shifts
  if (end1 < start1) end1 = new Date(`2000-01-02T${shift1End}:00`)
  if (end2 < start2) end2 = new Date(`2000-01-02T${shift2End}:00`)

  return start1 < end2 && start2 < end1
}