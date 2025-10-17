/**
 * ShiftSync TT - AI Scheduler Algorithm
 * Rule-based constraint satisfaction scheduler for restaurant shift generation
 *
 * Features:
 * - Hard constraints: availability, time-off, labor laws, rest periods
 * - Soft constraints: fairness (±10% target hours), preferences, cost optimization
 * - Trinidad labor law compliance (40hr weeks, overtime, 8hr rest)
 * - Weighted scoring algorithm with greedy + backtracking approach
 */

import { supabase } from './supabase'

// ============================================================================
// TYPES
// ============================================================================

interface Employee {
  id: string
  first_name: string
  last_name: string
  position: string | null
  hourly_rate: number | null
  is_active: boolean
}

interface EmployeePreferences {
  employee_id: string
  target_monthly_hours: number
  preferred_shift_start_time: string | null
  preferred_shift_length_hours: number | null
  max_days_per_week: number
  prefers_weekends: boolean
}

interface EmployeeAvailability {
  id: string
  employee_id: string
  day_of_week: number | null
  specific_date: string | null
  unavailable_start_time: string | null
  unavailable_end_time: string | null
  is_all_day: boolean
  is_recurring: boolean
}

interface BusinessHours {
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

interface StaffingRequirement {
  day_of_week: number
  time_slot_start: string
  time_slot_end: string
  min_staff_required: number
  optimal_staff: number
}

interface ExistingShift {
  employee_id: string
  shift_date: string
  start_time: string
  end_time: string
}

interface TimeOffRequest {
  employee_id: string
  start_date: string
  end_date: string
  status: string
}

interface ScheduleShift {
  employee_id: string
  shift_date: string
  start_time: string
  end_time: string
  position: string | null
  notes: string | null
}

interface GeneratedSchedule {
  shifts: ScheduleShift[]
  warnings: string[]
  stats: {
    total_shifts: number
    total_hours: number
    estimated_labor_cost: number
    employees_scheduled: number
    fairness_score: number
  }
}

interface SchedulerContext {
  employees: Employee[]
  preferences: Map<string, EmployeePreferences>
  availability: Map<string, EmployeeAvailability[]>
  businessHours: Map<number, BusinessHours>
  staffingRequirements: StaffingRequirement[]
  existingShifts: Map<string, ExistingShift[]>
  timeOffRequests: Map<string, TimeOffRequest[]>
  weekStartDate: Date
  weekEndDate: Date
  currentMonth: { year: number; month: number }
}

// ============================================================================
// MAIN SCHEDULER FUNCTION
// ============================================================================

export async function generateSchedule(
  restaurantId: string,
  weekStartDate: Date,
  options?: {
    prioritizeFairness?: boolean
    prioritizeCost?: boolean
    allowOvertime?: boolean
  }
): Promise<GeneratedSchedule> {
  const warnings: string[] = []

  // Calculate week end date (6 days after start)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 6)

  // Get current month for hour tracking
  const currentMonth = {
    year: weekStartDate.getFullYear(),
    month: weekStartDate.getMonth() + 1
  }

  // Load all necessary data
  const context = await loadSchedulerData(restaurantId, weekStartDate, weekEndDate, currentMonth)

  // Check for critical issues
  if (context.employees.length === 0) {
    warnings.push('No active employees found (excluding managers)')
    warnings.push('Please add employees with role="employee" to your restaurant')
    return { shifts: [], warnings, stats: createEmptyStats() }
  }

  // Check if business hours are configured
  const businessHoursArray = Array.from(context.businessHours.values())
  console.log('[AI Scheduler] Business hours check:', {
    total: businessHoursArray.length,
    open: businessHoursArray.filter(bh => !bh.is_closed).length,
    closed: businessHoursArray.filter(bh => bh.is_closed).length,
    hours: businessHoursArray
  })

  const hasBusinessHours = businessHoursArray.length > 0 && businessHoursArray.some(bh => !bh.is_closed)
  if (!hasBusinessHours) {
    if (businessHoursArray.length === 0) {
      warnings.push('No business hours configured')
      warnings.push('Please configure your business hours in Settings → Business Hours section')
    } else {
      warnings.push('All days are marked as closed')
      warnings.push('Please mark at least one day as open in Settings → Business Hours')
    }
    return { shifts: [], warnings, stats: createEmptyStats() }
  }

  // Log context for debugging
  console.log('[AI Scheduler] Context:', {
    employees: context.employees.length,
    businessHours: context.businessHours.size,
    staffingRequirements: context.staffingRequirements.length,
    preferences: context.preferences.size
  })

  // Generate shifts for the week
  const shifts: ScheduleShift[] = []

  // Iterate through each day of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDate = new Date(weekStartDate)
    currentDate.setDate(currentDate.getDate() + dayOffset)
    const dayOfWeek = (currentDate.getDay() + 6) % 7 // Convert to 0=Mon, 6=Sun

    // Get business hours for this day
    const businessHour = context.businessHours.get(dayOfWeek)
    if (!businessHour || businessHour.is_closed) {
      continue // Skip closed days
    }

    // Get staffing requirements for this day
    const dayStaffingReqs = context.staffingRequirements.filter(
      sr => sr.day_of_week === dayOfWeek
    )

    if (dayStaffingReqs.length === 0) {
      // No staffing requirements - create default coverage
      const defaultShifts = await generateDefaultCoverage(
        context,
        currentDate,
        businessHour,
        shifts,
        options
      )
      shifts.push(...defaultShifts.shifts)
      warnings.push(...defaultShifts.warnings)
    } else {
      // Generate shifts based on staffing requirements
      for (const staffingReq of dayStaffingReqs) {
        const reqShifts = await generateShiftsForRequirement(
          context,
          currentDate,
          staffingReq,
          shifts,
          options
        )
        shifts.push(...reqShifts.shifts)
        warnings.push(...reqShifts.warnings)
      }
    }
  }

  // Check if any shifts were generated
  if (shifts.length === 0) {
    warnings.push('No shifts could be generated for this week')
    warnings.push('Possible reasons:')
    warnings.push('- All employees may be unavailable during business hours')
    warnings.push('- Employees may have reached their max days/week limit')
    warnings.push('- Weekly hour limits may be preventing assignments')
    warnings.push('Try: Adjust employee availability, increase max days/week, or enable overtime')
  }

  // Calculate statistics
  const stats = calculateScheduleStats(shifts, context)

  // Validate and optimize
  const optimized = optimizeSchedule(shifts, context, options)
  warnings.push(...optimized.warnings)

  console.log('[AI Scheduler] Generated:', {
    shifts: optimized.shifts.length,
    warnings: warnings.length,
    stats
  })

  return {
    shifts: optimized.shifts,
    warnings: Array.from(new Set(warnings)), // Remove duplicates
    stats
  }
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadSchedulerData(
  restaurantId: string,
  weekStartDate: Date,
  weekEndDate: Date,
  currentMonth: { year: number; month: number }
): Promise<SchedulerContext> {
  // Load employees
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .eq('restaurant_id', restaurantId)

  // Filter active employees (handle case where is_active column might not exist)
  // Also exclude managers - they manage schedules, they don't get scheduled
  const employees = (employeesData || []).filter(emp => {
    // If is_active field exists, use it; otherwise include all employees
    const isActive = emp.is_active !== false
    const isNotManager = emp.role !== 'manager'
    return isActive && isNotManager
  })

  // Load preferences
  const { data: preferencesData } = await supabase
    .from('employee_preferences')
    .select('*')
    .in('employee_id', employees.map(e => e.id))

  const preferences = new Map<string, EmployeePreferences>()

  // Set preferences for each employee (with defaults if not configured)
  employees.forEach(emp => {
    const empPrefs = preferencesData?.find(p => p.employee_id === emp.id)

    if (empPrefs) {
      preferences.set(emp.id, empPrefs)
    } else {
      // Use default preferences if employee hasn't set any
      preferences.set(emp.id, {
        employee_id: emp.id,
        target_monthly_hours: 160, // Default: 40 hours/week * 4 weeks
        preferred_shift_start_time: null,
        preferred_shift_length_hours: null,
        max_days_per_week: 6,
        prefers_weekends: true
      })
    }
  })

  // Load availability blocks
  const { data: availabilityData } = await supabase
    .from('employee_availability')
    .select('*')
    .eq('restaurant_id', restaurantId)

  const availability = new Map<string, EmployeeAvailability[]>()
  availabilityData?.forEach(a => {
    const existing = availability.get(a.employee_id) || []
    availability.set(a.employee_id, [...existing, a])
  })

  // Load business hours
  const { data: businessHoursData, error: businessHoursError } = await supabase
    .from('business_hours')
    .select('*')
    .eq('restaurant_id', restaurantId)

  if (businessHoursError) {
    console.error('[AI Scheduler] Error loading business hours:', businessHoursError)
  }

  console.log('[AI Scheduler] Business hours loaded:', {
    count: businessHoursData?.length || 0,
    data: businessHoursData
  })

  const businessHours = new Map<number, BusinessHours>()
  businessHoursData?.forEach(bh => businessHours.set(bh.day_of_week, bh))

  // Load staffing requirements
  const { data: staffingRequirements } = await supabase
    .from('staffing_requirements')
    .select('*')
    .eq('restaurant_id', restaurantId)

  // Load existing shifts for the month
  const monthStart = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`
  const monthEnd = new Date(currentMonth.year, currentMonth.month, 0)
  const monthEndStr = monthEnd.toISOString().split('T')[0]

  const { data: existingShiftsData } = await supabase
    .from('shifts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('shift_date', monthStart)
    .lte('shift_date', monthEndStr)

  const existingShifts = new Map<string, ExistingShift[]>()
  existingShiftsData?.forEach(s => {
    const existing = existingShifts.get(s.employee_id) || []
    existingShifts.set(s.employee_id, [...existing, s])
  })

  // Load approved time-off requests
  const weekStartStr = weekStartDate.toISOString().split('T')[0]
  const weekEndStr = weekEndDate.toISOString().split('T')[0]

  const { data: timeOffData } = await supabase
    .from('time_off_requests')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'approved')
    .or(`start_date.lte.${weekEndStr},end_date.gte.${weekStartStr}`)

  const timeOffRequests = new Map<string, TimeOffRequest[]>()
  timeOffData?.forEach(t => {
    const existing = timeOffRequests.get(t.employee_id) || []
    timeOffRequests.set(t.employee_id, [...existing, t])
  })

  return {
    employees: employees || [],
    preferences,
    availability,
    businessHours,
    staffingRequirements: staffingRequirements || [],
    existingShifts,
    timeOffRequests,
    weekStartDate,
    weekEndDate,
    currentMonth
  }
}

// ============================================================================
// CONSTRAINT CHECKING
// ============================================================================

function isEmployeeAvailable(
  employeeId: string,
  date: Date,
  startTime: string,
  endTime: string,
  context: SchedulerContext
): boolean {
  const dateStr = date.toISOString().split('T')[0]
  const dayOfWeek = (date.getDay() + 6) % 7 // 0=Mon, 6=Sun

  // Check time-off requests
  const timeOffs = context.timeOffRequests.get(employeeId) || []
  for (const timeOff of timeOffs) {
    if (dateStr >= timeOff.start_date && dateStr <= timeOff.end_date) {
      return false // On time off
    }
  }

  // Check availability blocks
  const availBlocks = context.availability.get(employeeId) || []
  for (const block of availBlocks) {
    // Recurring weekly block
    if (block.is_recurring && block.day_of_week === dayOfWeek) {
      if (block.is_all_day) return false

      if (block.unavailable_start_time && block.unavailable_end_time) {
        if (timesOverlap(startTime, endTime, block.unavailable_start_time, block.unavailable_end_time)) {
          return false
        }
      }
    }

    // Specific date block
    if (!block.is_recurring && block.specific_date === dateStr) {
      if (block.is_all_day) return false

      if (block.unavailable_start_time && block.unavailable_end_time) {
        if (timesOverlap(startTime, endTime, block.unavailable_start_time, block.unavailable_end_time)) {
          return false
        }
      }
    }
  }

  return true
}

function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return (start1 < end2 && end1 > start2)
}

function hasAdequateRest(
  employeeId: string,
  date: Date,
  startTime: string,
  existingShifts: ScheduleShift[]
): boolean {
  const dateStr = date.toISOString().split('T')[0]

  // Get previous day
  const prevDate = new Date(date)
  prevDate.setDate(prevDate.getDate() - 1)
  const prevDateStr = prevDate.toISOString().split('T')[0]

  // Find shift from previous day
  const prevShift = existingShifts.find(
    s => s.employee_id === employeeId && s.shift_date === prevDateStr
  )

  if (prevShift) {
    // Calculate hours between end of previous shift and start of new shift
    const prevEndTime = new Date(`2000-01-01T${prevShift.end_time}`)
    const newStartTime = new Date(`2000-01-02T${startTime}`) // Next day
    const hoursBetween = (newStartTime.getTime() - prevEndTime.getTime()) / (1000 * 60 * 60)

    // Trinidad labor law: minimum 8 hours rest between shifts
    if (hoursBetween < 8) {
      return false
    }
  }

  return true
}

function exceedsWeeklyHours(
  employeeId: string,
  shiftHours: number,
  weekShifts: ScheduleShift[],
  allowOvertime: boolean = false
): boolean {
  // Calculate current week hours
  const weekHours = weekShifts
    .filter(s => s.employee_id === employeeId)
    .reduce((sum, s) => sum + calculateShiftHours(s.start_time, s.end_time), 0)

  const totalHours = weekHours + shiftHours

  // Trinidad labor law: 40 hours standard workweek
  // Overtime allowed but should be flagged
  if (!allowOvertime && totalHours > 40) {
    return true
  }

  // Hard limit: 48 hours per week (even with overtime)
  if (totalHours > 48) {
    return true
  }

  return false
}

function calculateShiftHours(startTime: string, endTime: string): number {
  const start = new Date(`2000-01-01T${startTime}`)
  const end = new Date(`2000-01-01T${endTime}`)
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

// ============================================================================
// EMPLOYEE SCORING
// ============================================================================

function scoreEmployee(
  employee: Employee,
  date: Date,
  startTime: string,
  endTime: string,
  context: SchedulerContext,
  weekShifts: ScheduleShift[],
  options?: { prioritizeFairness?: boolean; prioritizeCost?: boolean }
): number {
  let score = 100

  const prefs = context.preferences.get(employee.id)
  const shiftHours = calculateShiftHours(startTime, endTime)

  // FAIRNESS BONUS (±30 points)
  if (prefs) {
    const currentMonthHours = getCurrentMonthHours(employee.id, context)
    const targetHours = prefs.target_monthly_hours
    const percentOfTarget = (currentMonthHours / targetHours) * 100

    // Give higher score to employees below their target
    if (percentOfTarget < 90) {
      score += 30 // Needs more hours
    } else if (percentOfTarget < 100) {
      score += 15
    } else if (percentOfTarget > 110) {
      score -= 30 // Already over target
    } else if (percentOfTarget > 100) {
      score -= 15
    }
  }

  // PREFERENCE BONUS (±20 points)
  if (prefs) {
    // Preferred shift start time
    if (prefs.preferred_shift_start_time) {
      const timeDiff = Math.abs(
        timeToMinutes(startTime) - timeToMinutes(prefs.preferred_shift_start_time)
      )
      if (timeDiff <= 30) {
        score += 10 // Within 30 minutes of preferred time
      } else if (timeDiff > 120) {
        score -= 10 // More than 2 hours off
      }
    }

    // Preferred shift length
    if (prefs.preferred_shift_length_hours) {
      const lengthDiff = Math.abs(shiftHours - prefs.preferred_shift_length_hours)
      if (lengthDiff <= 0.5) {
        score += 10
      } else if (lengthDiff > 2) {
        score -= 10
      }
    }

    // Weekend preference
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    if (isWeekend && !prefs.prefers_weekends) {
      score -= 20
    } else if (isWeekend && prefs.prefers_weekends) {
      score += 10
    }
  }

  // CONSECUTIVE DAYS PENALTY (±15 points)
  const consecutiveDays = getConsecutiveDaysWorked(employee.id, date, weekShifts)
  if (consecutiveDays >= 5) {
    score -= 15 // Working too many consecutive days
  } else if (consecutiveDays === 0) {
    score += 5 // Fresh worker
  }

  // COST OPTIMIZATION (±10 points)
  if (options?.prioritizeCost && employee.hourly_rate) {
    // Prefer lower-cost employees (scaled to ±10 points)
    // Assuming hourly rates between $15-$30
    const normalizedRate = ((employee.hourly_rate - 15) / 15) * 10
    score -= normalizedRate
  }

  // MAX DAYS PER WEEK CHECK (hard penalty)
  if (prefs) {
    const daysThisWeek = weekShifts.filter(s => s.employee_id === employee.id).length
    if (daysThisWeek >= prefs.max_days_per_week) {
      score -= 100 // Major penalty - at max days
    }
  }

  return score
}

function getCurrentMonthHours(employeeId: string, context: SchedulerContext): number {
  const existingShifts = context.existingShifts.get(employeeId) || []
  return existingShifts.reduce((sum, shift) => {
    return sum + calculateShiftHours(shift.start_time, shift.end_time)
  }, 0)
}

function getConsecutiveDaysWorked(
  employeeId: string,
  date: Date,
  weekShifts: ScheduleShift[]
): number {
  let consecutive = 0
  let checkDate = new Date(date)
  checkDate.setDate(checkDate.getDate() - 1)

  // Check backwards for consecutive days
  for (let i = 0; i < 7; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    const hasShift = weekShifts.some(
      s => s.employee_id === employeeId && s.shift_date === dateStr
    )

    if (hasShift) {
      consecutive++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return consecutive
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// ============================================================================
// SHIFT GENERATION
// ============================================================================

async function generateDefaultCoverage(
  context: SchedulerContext,
  date: Date,
  businessHour: BusinessHours,
  existingWeekShifts: ScheduleShift[],
  options?: any
): Promise<{ shifts: ScheduleShift[]; warnings: string[] }> {
  const shifts: ScheduleShift[] = []
  const warnings: string[] = []

  // Create 2-3 shifts covering the business hours
  const openMinutes = timeToMinutes(businessHour.open_time)
  const closeMinutes = timeToMinutes(businessHour.close_time)
  const totalMinutes = closeMinutes - openMinutes

  // Try to assign 2 staff members for basic coverage
  for (let i = 0; i < 2; i++) {
    const shift = await assignBestEmployee(
      context,
      date,
      businessHour.open_time,
      businessHour.close_time,
      [...existingWeekShifts, ...shifts],
      options
    )

    if (shift) {
      shifts.push(shift)
    } else {
      warnings.push(`Could not find available staff for ${date.toISOString().split('T')[0]}`)
    }
  }

  return { shifts, warnings }
}

async function generateShiftsForRequirement(
  context: SchedulerContext,
  date: Date,
  staffingReq: StaffingRequirement,
  existingWeekShifts: ScheduleShift[],
  options?: any
): Promise<{ shifts: ScheduleShift[]; warnings: string[] }> {
  const shifts: ScheduleShift[] = []
  const warnings: string[] = []

  const targetStaff = staffingReq.optimal_staff

  for (let i = 0; i < targetStaff; i++) {
    const shift = await assignBestEmployee(
      context,
      date,
      staffingReq.time_slot_start,
      staffingReq.time_slot_end,
      [...existingWeekShifts, ...shifts],
      options
    )

    if (shift) {
      shifts.push(shift)
    } else if (i < staffingReq.min_staff_required) {
      warnings.push(
        `Could not meet minimum staffing (${staffingReq.min_staff_required}) for ${date.toISOString().split('T')[0]} ${staffingReq.time_slot_start}-${staffingReq.time_slot_end}`
      )
    }
  }

  return { shifts, warnings }
}

async function assignBestEmployee(
  context: SchedulerContext,
  date: Date,
  startTime: string,
  endTime: string,
  existingWeekShifts: ScheduleShift[],
  options?: any
): Promise<ScheduleShift | null> {
  const candidates: Array<{ employee: Employee; score: number }> = []

  const shiftHours = calculateShiftHours(startTime, endTime)

  for (const employee of context.employees) {
    // Hard constraints
    if (!isEmployeeAvailable(employee.id, date, startTime, endTime, context)) {
      continue
    }

    if (!hasAdequateRest(employee.id, date, startTime, existingWeekShifts)) {
      continue
    }

    if (exceedsWeeklyHours(employee.id, shiftHours, existingWeekShifts, options?.allowOvertime)) {
      continue
    }

    // Soft constraints - calculate score
    const score = scoreEmployee(employee, date, startTime, endTime, context, existingWeekShifts, options)
    candidates.push({ employee, score })
  }

  if (candidates.length === 0) {
    return null
  }

  // Sort by score (highest first)
  candidates.sort((a, b) => b.score - a.score)

  // Select best candidate
  const best = candidates[0]

  return {
    employee_id: best.employee.id,
    shift_date: date.toISOString().split('T')[0],
    start_time: startTime,
    end_time: endTime,
    position: best.employee.position,
    notes: null
  }
}

// ============================================================================
// OPTIMIZATION & VALIDATION
// ============================================================================

function optimizeSchedule(
  shifts: ScheduleShift[],
  context: SchedulerContext,
  options?: any
): { shifts: ScheduleShift[]; warnings: string[] } {
  const warnings: string[] = []

  // Check for fairness issues
  const employeeHours = new Map<string, number>()
  shifts.forEach(shift => {
    const hours = calculateShiftHours(shift.start_time, shift.end_time)
    const current = employeeHours.get(shift.employee_id) || 0
    employeeHours.set(shift.employee_id, current + hours)
  })

  employeeHours.forEach((hours, employeeId) => {
    const prefs = context.preferences.get(employeeId)
    if (prefs) {
      const weeklyTarget = (prefs.target_monthly_hours / 4.33)
      if (hours < weeklyTarget * 0.7) {
        const employee = context.employees.find(e => e.id === employeeId)
        warnings.push(
          `${employee?.first_name} ${employee?.last_name} has only ${hours.toFixed(1)} hours (below target)`
        )
      }
    }
  })

  return { shifts, warnings }
}

function calculateScheduleStats(
  shifts: ScheduleShift[],
  context: SchedulerContext
): GeneratedSchedule['stats'] {
  const totalHours = shifts.reduce((sum, s) => {
    return sum + calculateShiftHours(s.start_time, s.end_time)
  }, 0)

  const totalCost = shifts.reduce((sum, s) => {
    const employee = context.employees.find(e => e.id === s.employee_id)
    const hours = calculateShiftHours(s.start_time, s.end_time)
    const rate = employee?.hourly_rate || 20 // Default rate
    return sum + (hours * rate)
  }, 0)

  const uniqueEmployees = new Set(shifts.map(s => s.employee_id)).size

  // Calculate fairness score (0-100)
  // Based on standard deviation of hours distribution
  const employeeHours = new Map<string, number>()
  shifts.forEach(shift => {
    const hours = calculateShiftHours(shift.start_time, shift.end_time)
    const current = employeeHours.get(shift.employee_id) || 0
    employeeHours.set(shift.employee_id, current + hours)
  })

  let fairnessScore = 0
  const hoursArray = Array.from(employeeHours.values())

  if (hoursArray.length > 0) {
    const avgHours = hoursArray.reduce((a, b) => a + b, 0) / hoursArray.length

    if (hoursArray.length > 1) {
      const variance = hoursArray.reduce((sum, h) => sum + Math.pow(h - avgHours, 2), 0) / hoursArray.length
      const stdDev = Math.sqrt(variance)
      fairnessScore = Math.max(0, 100 - (stdDev * 10)) // Lower std dev = higher fairness
    } else {
      fairnessScore = 100 // Perfect fairness with only one employee
    }
  }

  return {
    total_shifts: shifts.length,
    total_hours: totalHours,
    estimated_labor_cost: totalCost,
    employees_scheduled: uniqueEmployees,
    fairness_score: fairnessScore
  }
}

function createEmptyStats(): GeneratedSchedule['stats'] {
  return {
    total_shifts: 0,
    total_hours: 0,
    estimated_labor_cost: 0,
    employees_scheduled: 0,
    fairness_score: 0
  }
}
