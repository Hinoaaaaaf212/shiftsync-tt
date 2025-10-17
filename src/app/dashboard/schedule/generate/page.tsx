'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  DollarSign,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { generateSchedule } from '@/lib/ai-scheduler'
import { formatDateTrinidad, formatTimeTrinidad } from '@/lib/date-utils'

interface GeneratedShift {
  employee_id: string
  shift_date: string
  start_time: string
  end_time: string
  position: string | null
  notes: string | null
}

interface ScheduleStats {
  total_shifts: number
  total_hours: number
  estimated_labor_cost: number
  employees_scheduled: number
  fairness_score: number
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  position: string | null
}

export default function GenerateSchedulePage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()

  // Week selection
  const [weekStartDate, setWeekStartDate] = useState('')

  // Generation options
  const [prioritizeFairness, setPrioritizeFairness] = useState(true)
  const [prioritizeCost, setPrioritizeCost] = useState(false)
  const [allowOvertime, setAllowOvertime] = useState(false)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Results
  const [shifts, setShifts] = useState<GeneratedShift[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [stats, setStats] = useState<ScheduleStats | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])

  // Publishing
  const [publishing, setPublishing] = useState(false)

  // Migration check
  const [migrationChecked, setMigrationChecked] = useState(false)
  const [migrationMissing, setMigrationMissing] = useState(false)

  // Redirect if not authenticated or not a manager
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
    if (!loading && user && !restaurant && !employee) {
      router.push('/auth/setup-restaurant')
    }
    if (!loading && employee && employee.role !== 'manager') {
      router.push('/dashboard')
    }
  }, [user, employee, restaurant, loading, router])

  // Check if migration has been run
  useEffect(() => {
    async function checkMigration() {
      if (!restaurant?.id) return

      try {
        // Try to query business_hours table to verify migration
        const { error } = await supabase
          .from('business_hours')
          .select('id')
          .limit(1)

        if (error) {
          console.error('Migration check failed:', error)
          if (error.code === '42P01') { // Table does not exist
            setMigrationMissing(true)
            setError('Database migration not run. Please run the migration in Supabase SQL Editor first. See AI_SCHEDULER_IMPLEMENTATION.md for instructions.')
          }
        } else {
          setMigrationChecked(true)
        }
      } catch (err) {
        console.error('Exception checking migration:', err)
      }
    }

    if (restaurant?.id && !loading) {
      checkMigration()
    }
  }, [restaurant?.id, loading])

  // Set default week to next Monday
  useEffect(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek // If Sunday, next day; else days until next Monday
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilMonday)
    setWeekStartDate(nextMonday.toISOString().split('T')[0])
  }, [])

  // Load employees
  useEffect(() => {
    async function loadEmployees() {
      if (!restaurant?.id) return

      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, first_name, last_name, position, is_active')
          .eq('restaurant_id', restaurant.id)

        if (error) {
          console.error('Error loading employees:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          })
          setError(`Failed to load employees: ${error.message}`)
        } else {
          // Filter active employees in code (in case is_active column doesn't exist)
          const activeEmployees = (data || []).filter(emp => {
            // If is_active field exists, use it; otherwise include all employees
            return emp.is_active !== false
          })
          setEmployees(activeEmployees)
        }
      } catch (err) {
        console.error('Exception loading employees:', err)
        setError('Failed to load employees. Please refresh the page.')
      }
    }

    if (restaurant?.id && !loading) {
      loadEmployees()
    }
  }, [restaurant?.id, loading])

  const handleGenerateSchedule = async () => {
    if (!restaurant?.id || !weekStartDate) {
      setError('Please select a week start date')
      return
    }

    setGenerating(true)
    setError(null)
    setGenerated(false)

    try {
      const startDate = new Date(weekStartDate)

      // Ensure it's a Monday
      if (startDate.getDay() !== 1) {
        setError('Week must start on a Monday')
        setGenerating(false)
        return
      }

      const result = await generateSchedule(restaurant.id, startDate, {
        prioritizeFairness,
        prioritizeCost,
        allowOvertime
      })

      console.log('[Generator UI] Result:', result)

      setShifts(result.shifts)
      setWarnings(result.warnings)
      setStats(result.stats)
      setGenerated(true)

      // If no shifts generated, show error
      if (result.shifts.length === 0) {
        setError('No shifts were generated. Check the warnings below for details.')
      }

    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate schedule')
    } finally {
      setGenerating(false)
    }
  }

  const handlePublishSchedule = async () => {
    if (!restaurant?.id || !employee?.id || shifts.length === 0) return

    setPublishing(true)
    setError(null)

    try {
      // Save to ai_generated_schedules
      const { data: scheduleRecord, error: scheduleError } = await supabase
        .from('ai_generated_schedules')
        .insert({
          restaurant_id: restaurant.id,
          week_start_date: weekStartDate,
          generation_params: {
            prioritizeFairness,
            prioritizeCost,
            allowOvertime
          },
          total_shifts: stats?.total_shifts || 0,
          total_hours: stats?.total_hours || 0,
          estimated_labor_cost: stats?.estimated_labor_cost || 0,
          warnings: warnings,
          status: 'published',
          generated_by: employee.user_id,
          published_at: new Date().toISOString()
        })
        .select()
        .single()

      if (scheduleError) throw scheduleError

      // Insert all shifts
      const { error: shiftsError } = await supabase
        .from('shifts')
        .insert(
          shifts.map(shift => ({
            ...shift,
            restaurant_id: restaurant.id
          }))
        )

      if (shiftsError) throw shiftsError

      // Success - redirect to schedule page
      router.push('/dashboard/schedule')

    } catch (err) {
      console.error('Publishing error:', err)
      setError(err instanceof Error ? err.message : 'Failed to publish schedule')
    } finally {
      setPublishing(false)
    }
  }

  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId)
    return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'
  }

  const groupShiftsByDate = () => {
    const grouped = new Map<string, GeneratedShift[]>()
    shifts.forEach(shift => {
      const existing = grouped.get(shift.shift_date) || []
      grouped.set(shift.shift_date, [...existing, shift])
    })
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (employee.role !== 'manager') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only managers can generate schedules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/schedule')}
              className="text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Schedule
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-600" />
                AI Schedule Generator
              </h1>
              <p className="text-sm text-gray-500">Automatically generate optimized shifts</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Migration Missing Alert */}
        {migrationMissing && (
          <Card className="mb-6 border-yellow-300 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <AlertCircle className="w-5 h-5" />
                Database Migration Required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-yellow-800 space-y-3">
              <p className="font-medium">
                The AI Scheduler database tables have not been created yet. Please run the migration first.
              </p>
              <div className="bg-white rounded p-4 border border-yellow-200">
                <p className="font-semibold mb-2">Steps to run migration:</p>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Open your Supabase project dashboard</li>
                  <li>Navigate to <strong>SQL Editor</strong></li>
                  <li>Open the file: <code className="bg-gray-100 px-2 py-1 rounded">database/add-ai-scheduling-tables.sql</code></li>
                  <li>Copy the entire script and paste it into the SQL Editor</li>
                  <li>Click <strong>Run</strong></li>
                  <li>Refresh this page</li>
                </ol>
              </div>
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  See <strong>AI_SCHEDULER_IMPLEMENTATION.md</strong> for detailed setup instructions.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && !migrationMissing && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {!generated ? (
          /* Generation Settings */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Settings Card */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Generation Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your schedule generation preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Week Selection */}
                  <div>
                    <Label htmlFor="weekStart">Week Start Date (Monday)</Label>
                    <Input
                      id="weekStart"
                      type="date"
                      value={weekStartDate}
                      onChange={(e) => setWeekStartDate(e.target.value)}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Select the Monday of the week you want to generate
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Optimization Priorities</h3>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="text-base font-medium">Prioritize Fairness</Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Distribute hours evenly among employees
                        </p>
                      </div>
                      <Button
                        variant={prioritizeFairness ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPrioritizeFairness(!prioritizeFairness)}
                      >
                        {prioritizeFairness ? 'ON' : 'OFF'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="text-base font-medium">Prioritize Cost</Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Minimize labor costs by preferring lower-paid staff
                        </p>
                      </div>
                      <Button
                        variant={prioritizeCost ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPrioritizeCost(!prioritizeCost)}
                      >
                        {prioritizeCost ? 'ON' : 'OFF'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="text-base font-medium">Allow Overtime</Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Allow employees to work over 40 hours/week if needed
                        </p>
                      </div>
                      <Button
                        variant={allowOvertime ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAllowOvertime(!allowOvertime)}
                      >
                        {allowOvertime ? 'ON' : 'OFF'}
                      </Button>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <Button
                    onClick={handleGenerateSchedule}
                    disabled={generating || !weekStartDate || migrationMissing}
                    className="w-full"
                    size="lg"
                  >
                    {generating ? (
                      <>
                        <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                        Generating Schedule...
                      </>
                    ) : migrationMissing ? (
                      <>
                        <AlertCircle className="w-5 h-5 mr-2" />
                        Migration Required
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Generate Schedule
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Info Card */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700 space-y-3">
                  <div>
                    <p className="font-medium text-gray-900 mb-1">1. Loads Data</p>
                    <p className="text-xs text-gray-600">
                      Employee preferences, availability, business hours, and staffing requirements
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 mb-1">2. Applies Constraints</p>
                    <p className="text-xs text-gray-600">
                      Respects unavailability, time-off, rest periods, and labor laws
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 mb-1">3. Optimizes Assignments</p>
                    <p className="text-xs text-gray-600">
                      Scores employees based on fairness, preferences, and cost
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 mb-1">4. Validates Schedule</p>
                    <p className="text-xs text-gray-600">
                      Checks for issues and provides warnings
                    </p>
                  </div>

                  <Alert className="mt-4">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-xs">
                      You can review and manually adjust the generated schedule before publishing.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Generated Results */
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Shifts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary-600" />
                    <span className="text-2xl font-bold text-gray-900">{stats?.total_shifts || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary-600" />
                    <span className="text-2xl font-bold text-gray-900">{stats?.total_hours.toFixed(1) || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Estimated Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary-600" />
                    <span className="text-2xl font-bold text-gray-900">
                      ${stats?.estimated_labor_cost.toFixed(0) || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Fairness Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary-600" />
                    <span className="text-2xl font-bold text-gray-900">{stats?.fairness_score.toFixed(0) || 0}</span>
                    <span className="text-sm text-gray-500">/100</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <Alert className={`border-yellow-200 ${shifts.length === 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50'}`}>
                <AlertCircle className={`w-4 h-4 ${shifts.length === 0 ? 'text-red-600' : 'text-yellow-600'}`} />
                <AlertDescription>
                  <p className={`font-medium mb-2 ${shifts.length === 0 ? 'text-red-900' : 'text-yellow-900'}`}>
                    {shifts.length === 0 ? 'Critical Issues' : 'Warnings'} ({warnings.length})
                  </p>
                  <ul className={`text-sm space-y-1 ${shifts.length === 0 ? 'text-red-800' : 'text-yellow-800'}`}>
                    {warnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Generated Shifts */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {shifts.length > 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      {shifts.length > 0 ? 'Generated Schedule' : 'No Shifts Generated'}
                    </CardTitle>
                    <CardDescription>
                      {shifts.length > 0
                        ? 'Review the generated shifts before publishing'
                        : 'Please check the issues above and try again'}
                    </CardDescription>
                  </div>
                  {shifts.length > 0 && (
                    <Button
                      onClick={handlePublishSchedule}
                      disabled={publishing}
                      size="lg"
                    >
                      {publishing ? (
                        <>
                          <Save className="w-4 h-4 mr-2 animate-pulse" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Publish Schedule
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {shifts.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No shifts were generated
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Check the critical issues above for details on why no shifts could be created.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setGenerated(false)}
                    >
                      Try Again with Different Settings
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupShiftsByDate().map(([date, dayShifts]) => (
                    <div key={date} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                      <h3 className="font-semibold text-gray-900 mb-3">
                        {formatDateTrinidad(new Date(date))}
                        <Badge className="ml-3 bg-gray-100 text-gray-800">
                          {dayShifts.length} shifts
                        </Badge>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dayShifts.map((shift, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {getEmployeeName(shift.employee_id)}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {formatTimeTrinidad(shift.start_time)} - {formatTimeTrinidad(shift.end_time)}
                                  </span>
                                </div>
                              </div>
                              {shift.position && (
                                <Badge className="bg-primary-100 text-primary-800 text-xs">
                                  {shift.position}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setGenerated(false)}
                className="flex-1"
              >
                Generate Again
              </Button>
              <Button
                onClick={handlePublishSchedule}
                disabled={publishing}
                className="flex-1"
                size="lg"
              >
                {publishing ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-pulse" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Publish Schedule
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
