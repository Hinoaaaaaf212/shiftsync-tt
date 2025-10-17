'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Users, Plus, Settings, LogOut, Sparkles, RotateCw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDateTrinidad, formatTimeTrinidad, getCurrentDateTrinidad } from '@/lib/date-utils'
import { getUpcomingShifts, getNextShift, getThisWeekHours } from '@/lib/shift-utils'
import { NotificationBell } from '@/components/notifications/notification-bell'

interface Shift {
  id: string
  employee_id: string
  shift_date: string
  start_time: string
  end_time: string
  position: string | null
  notes: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading, signOut } = useAuth()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [employeeCount, setEmployeeCount] = useState(0)
  const [allShifts, setAllShifts] = useState<Shift[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [pendingSwapRequests, setPendingSwapRequests] = useState(0)
  const [swapRequestsLoading, setSwapRequestsLoading] = useState(true)

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Redirect to setup if needed
  useEffect(() => {
    if (!loading && user) {
      // If no employee record at all, redirect to setup (new user flow)
      if (!employee && !restaurant) {
        router.push('/auth/setup-restaurant')
      }
      // If employee exists but is a manager without restaurant, redirect to setup
      else if (employee && employee.role === 'manager' && !restaurant) {
        router.push('/auth/setup-restaurant')
      }
    }
  }, [user, restaurant, employee, loading, router])

  // Fetch employee shifts
  useEffect(() => {
    async function fetchShifts() {
      if (!employee?.id) return

      setShiftsLoading(true)
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('employee_id', employee.id)
          .order('shift_date', { ascending: true })

        if (error) {
          console.error('Error fetching shifts:', error)
        } else {
          setShifts(data || [])
        }
      } catch (err) {
        console.error('Failed to fetch shifts:', err)
      } finally {
        setShiftsLoading(false)
      }
    }

    if (employee?.id && !loading) {
      fetchShifts()
    }
  }, [employee?.id, loading])

  // Fetch pending swap requests for employees
  useEffect(() => {
    async function fetchSwapRequests() {
      if (!employee?.id || employee.role === 'manager') return

      setSwapRequestsLoading(true)
      try {
        // Count requests where this employee is the requested employee and status is pending_employee
        const { count, error } = await supabase
          .from('shift_swap_requests')
          .select('*', { count: 'exact', head: true })
          .eq('requested_employee_id', employee.id)
          .eq('status', 'pending_employee')

        if (error) {
          console.error('Error fetching swap requests:', error)
        } else {
          setPendingSwapRequests(count || 0)
        }
      } catch (err) {
        console.error('Failed to fetch swap requests:', err)
      } finally {
        setSwapRequestsLoading(false)
      }
    }

    if (employee?.id && !loading) {
      fetchSwapRequests()
    }
  }, [employee?.id, employee?.role, loading])

  // Fetch manager stats (employee count and all shifts)
  useEffect(() => {
    async function fetchManagerStats() {
      if (!restaurant?.id || !employee || employee.role !== 'manager') return

      setStatsLoading(true)
      try {
        // Get employee count (excluding the manager themselves)
        const { count: empCount, error: empError } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id)
          .neq('role', 'manager')

        if (empError) {
          console.error('Error fetching employee count:', empError)
        } else {
          setEmployeeCount(empCount || 0)
        }

        // Get all shifts for the restaurant
        const { data: shiftsData, error: shiftsError } = await supabase
          .from('shifts')
          .select(`
            *,
            employees!inner(restaurant_id)
          `)
          .eq('employees.restaurant_id', restaurant.id)

        if (shiftsError) {
          console.error('Error fetching shifts:', shiftsError)
        } else {
          setAllShifts(shiftsData || [])
        }
      } catch (err) {
        console.error('Failed to fetch manager stats:', err)
      } finally {
        setStatsLoading(false)
      }
    }

    if (restaurant?.id && employee && !loading) {
      fetchManagerStats()
    }
  }, [restaurant?.id, employee, loading])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user || !employee || !restaurant) {
    return null // Will redirect
  }

  const isManager = employee.role === 'manager'
  const currentDate = getCurrentDateTrinidad()

  // Calculate shift data for employees
  const upcomingShifts = getUpcomingShifts(shifts)
  const nextShift = getNextShift(shifts)
  const weekHours = getThisWeekHours(shifts)

  // Calculate Getting Started completion status
  const hasEmployees = employeeCount > 0
  const hasShifts = allShifts.length > 0
  const allTasksComplete = hasEmployees && hasShifts

  // Calculate today's shifts for managers
  const todayShifts = allShifts.filter(shift => {
    const shiftDate = new Date(shift.shift_date)
    const today = new Date()
    return (
      shiftDate.getDate() === today.getDate() &&
      shiftDate.getMonth() === today.getMonth() &&
      shiftDate.getFullYear() === today.getFullYear()
    )
  })

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">ShiftSync TT</h1>
                <p className="text-sm text-gray-500">{restaurant.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {employee.first_name} {employee.last_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {employee.role}
                  {employee.position && ` • ${employee.position}`}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <NotificationBell />
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {employee.first_name}!
          </h2>
          <p className="text-gray-600">
            Today is {formatDateTrinidad(currentDate)}
          </p>
        </div>

        {/* Manager Dashboard */}
        {isManager && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Button
                className="btn btn-primary justify-start h-auto p-4 hover-lift animate-fade-in"
                onClick={() => router.push('/dashboard/shifts/add')}
              >
                <Plus className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Add Shift</div>
                  <div className="text-xs opacity-90">Schedule new shift</div>
                </div>
              </Button>

              <Button
                className="bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white justify-start h-auto p-4 hover-lift animate-fade-in animation-delay-50"
                onClick={() => router.push('/dashboard/schedule/generate')}
              >
                <Sparkles className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">AI Schedule</div>
                  <div className="text-xs opacity-90">Generate with AI</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start h-auto p-4 hover-lift animate-fade-in animation-delay-100"
                onClick={() => router.push('/dashboard/employees')}
              >
                <Users className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Manage Staff</div>
                  <div className="text-xs text-gray-500">Add/edit employees</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start h-auto p-4 hover-lift animate-fade-in animation-delay-200"
                onClick={() => router.push('/dashboard/schedule')}
              >
                <Calendar className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">View Schedule</div>
                  <div className="text-xs text-gray-500">Weekly overview</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start h-auto p-4 hover-lift animate-fade-in animation-delay-300"
                onClick={() => router.push('/dashboard/settings')}
              >
                <Settings className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Settings</div>
                  <div className="text-xs text-gray-500">Business setup</div>
                </div>
              </Button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover-glow animate-scale-in animation-delay-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Total Employees</CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-gray-900">{employeeCount}</div>
                      <p className="text-sm text-gray-500">
                        {employeeCount === 0 ? 'No employees added yet' : `Employee${employeeCount !== 1 ? 's' : ''} in your team`}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="hover-glow animate-scale-in animation-delay-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Today's Shifts</CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-gray-900">{todayShifts.length}</div>
                      <p className="text-sm text-gray-500">
                        {todayShifts.length === 0 ? 'No shifts scheduled' : `Shift${todayShifts.length !== 1 ? 's' : ''} today`}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="hover-glow animate-scale-in animation-delay-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-gray-900">{getThisWeekHours(allShifts).toFixed(1)}</div>
                      <p className="text-sm text-gray-500">Hours scheduled</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Getting Started - Only show if not all tasks complete */}
            {!allTasksComplete && (
              <Card>
                <CardHeader>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>
                    Complete these steps to start using ShiftSync TT
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Step 1: Business Setup - Always complete */}
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                        <span className="text-success-600 font-semibold text-sm">✓</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Business set up</p>
                        <p className="text-sm text-gray-500">{restaurant.name} is ready to go</p>
                      </div>
                    </div>

                    {/* Step 2: Add Employee */}
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        hasEmployees ? 'bg-success-100' : 'bg-gray-100'
                      }`}>
                        <span className={`font-semibold text-sm ${
                          hasEmployees ? 'text-success-600' : 'text-gray-500'
                        }`}>
                          {hasEmployees ? '✓' : '2'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Add your first employee</p>
                        <p className="text-sm text-gray-500">
                          {hasEmployees ? `${employeeCount} employee${employeeCount !== 1 ? 's' : ''} added` : 'Start building your team'}
                        </p>
                      </div>
                      {!hasEmployees && (
                        <Button size="sm" onClick={() => router.push('/dashboard/employees/add')}>
                          Add Employee
                        </Button>
                      )}
                    </div>

                    {/* Step 3: Create Schedule */}
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        hasShifts ? 'bg-success-100' : 'bg-gray-100'
                      }`}>
                        <span className={`font-semibold text-sm ${
                          hasShifts ? 'text-success-600' : 'text-gray-500'
                        }`}>
                          {hasShifts ? '✓' : '3'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Create your first schedule</p>
                        <p className="text-sm text-gray-500">
                          {hasShifts ? `${allShifts.length} shift${allShifts.length !== 1 ? 's' : ''} scheduled` : 'Schedule shifts for your team'}
                        </p>
                      </div>
                      {!hasShifts && (
                        <Button
                          size="sm"
                          disabled={!hasEmployees}
                          onClick={() => router.push('/dashboard/shifts/add')}
                        >
                          Create Schedule
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Employee Dashboard */}
        {!isManager && (
          <div className="space-y-6">
            {/* My Schedule */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Schedule</CardTitle>
                    <CardDescription>
                      Your upcoming shifts
                    </CardDescription>
                  </div>
                  {upcomingShifts.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/dashboard/my-shifts')}
                    >
                      View All Shifts
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {shiftsLoading ? (
                  <div className="text-center py-8 text-gray-400">Loading your shifts...</div>
                ) : upcomingShifts.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingShifts.slice(0, 5).map((shift) => (
                      <div
                        key={shift.id}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors duration-150"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary-600" />
                              <p className="font-semibold text-gray-900">
                                {formatDateTrinidad(new Date(shift.shift_date))}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <p className="text-sm text-gray-600">
                                {formatTimeTrinidad(shift.start_time)} - {formatTimeTrinidad(shift.end_time)}
                              </p>
                            </div>
                            {shift.notes && (
                              <p className="text-xs text-gray-500 mt-2">{shift.notes}</p>
                            )}
                          </div>
                          {shift.position && (
                            <Badge className="bg-primary-100 text-primary-800">{shift.position}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {upcomingShifts.length > 5 && (
                      <p className="text-sm text-gray-500 text-center pt-2">
                        And {upcomingShifts.length - 5} more shift{upcomingShifts.length - 5 !== 1 ? 's' : ''}...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Calendar className="empty-state-icon w-16 h-16" />
                    <h3 className="empty-state-title">No shifts scheduled yet</h3>
                    <p className="empty-state-description">
                      Your manager will assign shifts that will appear here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>This Week's Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  {shiftsLoading ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-gray-900">{weekHours.toFixed(1)}</div>
                      <p className="text-sm text-gray-500">Hours scheduled</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Next Shift</CardTitle>
                </CardHeader>
                <CardContent>
                  {shiftsLoading ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : nextShift ? (
                    <div>
                      <p className="font-semibold text-gray-900">
                        {formatDateTrinidad(new Date(nextShift.shift_date))}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeTrinidad(nextShift.start_time)} - {formatTimeTrinidad(nextShift.end_time)}
                      </p>
                      {nextShift.position && (
                        <Badge className="mt-2 bg-primary-100 text-primary-800">{nextShift.position}</Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">No upcoming shifts</p>
                  )}
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary-300 hover:shadow-md transition-all duration-200"
                onClick={() => router.push('/dashboard/swap-requests')}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Swap Requests</CardTitle>
                    <RotateCw className="w-4 h-4 text-primary-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  {swapRequestsLoading ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="text-3xl font-bold text-gray-900">{pendingSwapRequests}</div>
                        {pendingSwapRequests > 0 && (
                          <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {pendingSwapRequests === 0
                          ? 'No pending requests'
                          : `Request${pendingSwapRequests !== 1 ? 's' : ''} awaiting response`}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary-300 hover:shadow-md transition-all duration-200"
                onClick={() => router.push('/dashboard/preferences')}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>My Preferences</CardTitle>
                    <SlidersHorizontal className="w-4 h-4 text-primary-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600">
                    Set your work hours, availability, and scheduling preferences
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Shift scheduling info */}
        <Alert className="alert-info mt-8">
          <Calendar className="w-4 h-4" />
          <AlertDescription>
            <strong>Shift Scheduling:</strong> Create and manage employee shifts from the schedule page.
            Block specific dates from Settings to prevent shifts on holidays or closure days.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}