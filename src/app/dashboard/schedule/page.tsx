'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Plus, Filter, Download, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import {
  formatDateTrinidad,
  formatTimeTrinidad,
  getWeekStart,
  getWeekDays
} from '@/lib/date-utils'
import { exportWeeklyScheduleToPDF } from '@/lib/pdf-export'
import { getAllShiftConflicts, ShiftConflict } from '@/lib/conflict-utils'
import { Shift as FullShift } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

interface Shift {
  id: string
  employee_id: string
  shift_date: string
  start_time: string
  end_time: string
  position: string | null
  notes: string | null
  employee: {
    first_name: string
    last_name: string
    role: string
  }
}

interface Employee {
  id: string
  first_name: string
  last_name: string
}

function SchedulePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, employee, restaurant, loading } = useAuth()
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filterEmployee, setFilterEmployee] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conflictMap, setConflictMap] = useState<Map<string, ShiftConflict[]>>(new Map())

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
    if (!loading && user && !restaurant && !employee) {
      router.push('/auth/setup-restaurant')
    }
  }, [user, employee, restaurant, loading, router])

  // Set employee filter from URL parameter
  useEffect(() => {
    const employeeParam = searchParams.get('employee')
    if (employeeParam) {
      setFilterEmployee(employeeParam)
    }
  }, [searchParams])

  // Fetch employees for filter
  useEffect(() => {
    async function fetchEmployees() {
      if (!restaurant?.id) return

      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'active')
        .order('first_name', { ascending: true })

      if (error) {
        console.error('Error fetching employees:', error)
      } else {
        setEmployees(data || [])
      }
    }

    if (restaurant?.id) {
      fetchEmployees()
    }
  }, [restaurant])

  // Fetch shifts for the current week
  useEffect(() => {
    async function fetchShifts() {
      if (!restaurant?.id) return

      setIsLoading(true)
      setError(null)

      const weekDays = getWeekDays(currentWeekStart)
      const startDate = weekDays[0].toISOString().split('T')[0]
      const endDate = weekDays[6].toISOString().split('T')[0]

      let query = supabase
        .from('shifts')
        .select(`
          id,
          employee_id,
          shift_date,
          start_time,
          end_time,
          position,
          notes,
          employee:employees (
            first_name,
            last_name,
            role
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate)
        .order('start_time', { ascending: true })

      // Apply employee filter
      if (filterEmployee !== 'all') {
        query = query.eq('employee_id', filterEmployee)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Error fetching shifts:', fetchError)
        setError('Failed to load shifts')
      } else {
        setShifts(data || [])
      }

      setIsLoading(false)
    }

    if (restaurant?.id) {
      fetchShifts()
    }
  }, [restaurant, currentWeekStart, filterEmployee])

  // Detect conflicts for all shifts
  useEffect(() => {
    if (shifts.length === 0) {
      setConflictMap(new Map())
      return
    }

    // Transform shifts to the format expected by conflict detection
    const fullShifts: FullShift[] = shifts.map(shift => ({
      id: shift.id,
      employee_id: shift.employee_id,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      position: shift.position,
      notes: shift.notes,
      restaurant_id: restaurant?.id || '',
      created_at: '',
      updated_at: ''
    }))

    const conflicts = getAllShiftConflicts(fullShifts)
    setConflictMap(conflicts)
  }, [shifts, restaurant])

  const handlePreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() - 7)
    setCurrentWeekStart(newWeekStart)
  }

  const handleNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() + 7)
    setCurrentWeekStart(newWeekStart)
  }

  const handleToday = () => {
    setCurrentWeekStart(getWeekStart(new Date()))
  }

  const handleExportPDF = () => {
    if (!restaurant) return

    // Prepare employee data for PDF export
    const employeeData = employees.map(emp => ({
      id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      role: '', // We don't have role in the employees list
      position: undefined
    }))

    // Get employee details from shifts
    const shiftEmployeeMap = new Map<string, { role: string }>()
    shifts.forEach(shift => {
      if (shift.employee) {
        shiftEmployeeMap.set(shift.employee_id, {
          role: shift.employee.role
        })
      }
    })

    // Merge employee data with shift employee data
    const fullEmployeeData = employeeData.map(emp => ({
      ...emp,
      role: shiftEmployeeMap.get(emp.id)?.role || 'employee'
    }))

    // Transform shifts to match PDF export format
    const shiftsForExport = shifts.map(shift => ({
      id: shift.id,
      employee_id: shift.employee_id,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      position: shift.position,
      notes: shift.notes,
      restaurant_id: restaurant.id,
      created_at: '',
      updated_at: ''
    }))

    exportWeeklyScheduleToPDF({
      businessName: restaurant.name,
      weekStart: currentWeekStart,
      shifts: shiftsForExport,
      employees: fullEmployeeData
    })
  }

  const getShiftsForDate = (date: Date): Shift[] => {
    const dateString = date.toISOString().split('T')[0]
    return shifts.filter(shift => shift.shift_date === dateString)
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const hasConflict = (shiftId: string): boolean => {
    return conflictMap.has(shiftId)
  }

  const getConflictCount = (): number => {
    return conflictMap.size
  }

  const isManager = employee?.role === 'manager'

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    )
  }

  const weekDays = getWeekDays(currentWeekStart)
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Weekly Schedule</h1>
                <p className="text-sm text-gray-500">{restaurant.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={shifts.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              {isManager && (
                <>
                  <Button
                    onClick={() => router.push('/dashboard/schedule/generate')}
                    className="bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Schedule
                  </Button>
                  <Button onClick={() => router.push('/dashboard/shifts/add')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Shift
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Week Navigation */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Today
                </Button>
              </div>

              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">
                  {formatDateTrinidad(weekDays[0])} - {formatDateTrinidad(weekDays[6])}
                </p>
                <p className="text-sm text-gray-500">
                  Week of {weekDays[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert className="alert-error mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Conflict Warning */}
        {getConflictCount() > 0 && (
          <Alert className="alert-warning mb-6">
            <AlertDescription>
              <strong>Scheduling Conflicts Detected:</strong> {getConflictCount()} shift{getConflictCount() > 1 ? 's' : ''} with overlapping times. Conflicting shifts are highlighted in red.
            </AlertDescription>
          </Alert>
        )}

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayShifts = getShiftsForDate(day)
            const isTodayDate = isToday(day)

            return (
              <Card
                key={day.toISOString()}
                className={`${isTodayDate ? 'ring-2 ring-primary-500' : ''}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    {dayNames[index]}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {formatDateTrinidad(day)}
                    {isTodayDate && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Today
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-500">Loading...</p>
                    </div>
                  ) : dayShifts.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-500">No shifts</p>
                      {isManager && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => router.push('/dashboard/shifts/add')}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Shift
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayShifts.map((shift) => {
                        const shiftHasConflict = hasConflict(shift.id)
                        return (
                          <div
                            key={shift.id}
                            className={`bg-white border rounded-lg p-2 hover:shadow-sm transition-shadow ${
                              shiftHasConflict
                                ? 'border-red-500 bg-red-50'
                                : 'border-gray-200'
                            }`}
                            title={shiftHasConflict ? 'This shift has a time conflict' : ''}
                          >
                            <div className="flex items-start justify-between">
                              <p className="text-xs font-semibold text-gray-900">
                                {shift.employee.first_name} {shift.employee.last_name}
                              </p>
                              {shiftHasConflict && (
                                <Badge className="badge-error text-xs">
                                  Conflict
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-600">
                              {formatTimeTrinidad(shift.start_time)} - {formatTimeTrinidad(shift.end_time)}
                            </p>
                            {shift.position && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {shift.position}
                              </Badge>
                            )}
                            {shift.notes && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                {shift.notes}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Summary Stats */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Week Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Shifts</p>
                <p className="text-2xl font-bold text-gray-900">{shifts.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Employees Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(shifts.map(s => s.employee_id)).size}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {shifts.reduce((total, shift) => {
                    const start = new Date(`2000-01-01T${shift.start_time}`)
                    let end = new Date(`2000-01-01T${shift.end_time}`)
                    if (end < start) end = new Date(`2000-01-02T${shift.end_time}`)
                    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                    return total + hours
                  }, 0).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule notice */}
        <Alert className="alert-info mt-6">
          <Calendar className="w-4 h-4" />
          <AlertDescription>
            <strong>Weekly Schedule:</strong> Use the employee filter to view specific team members' shifts. Navigate between weeks using the arrow buttons.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    }>
      <SchedulePageContent />
    </Suspense>
  )
}
