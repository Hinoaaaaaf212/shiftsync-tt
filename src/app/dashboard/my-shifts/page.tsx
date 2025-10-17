'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, Filter, Download, Copy, Check, X, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDateTrinidad, formatTimeTrinidad, calculateShiftHours } from '@/lib/date-utils'
import { getUpcomingShifts, getPastShifts, calculateTotalHours, isShiftToday } from '@/lib/shift-utils'

interface Shift {
  id: string
  employee_id: string
  shift_date: string
  start_time: string
  end_time: string
  position: string | null
  notes: string | null
}

type ShiftFilter = 'all' | 'upcoming' | 'past'

export default function MyShiftsPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [filter, setFilter] = useState<ShiftFilter>('upcoming')
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [copied, setCopied] = useState(false)

  // Swap request modal states
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [eligibleShifts, setEligibleShifts] = useState<any[]>([])
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [swapNote, setSwapNote] = useState('')
  const [submittingSwap, setSubmittingSwap] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Redirect to setup if restaurant not created yet
  useEffect(() => {
    if (!loading && user && !restaurant && !employee) {
      router.push('/auth/setup-restaurant')
    }
  }, [user, restaurant, employee, loading, router])

  // Redirect managers to dashboard
  useEffect(() => {
    if (!loading && employee && employee.role === 'manager') {
      router.push('/dashboard/schedule')
    }
  }, [employee, loading, router])

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
          .order('shift_date', { ascending: false })

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

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading your shifts...</p>
        </div>
      </div>
    )
  }

  // Filter shifts based on selected filter
  const filteredShifts =
    filter === 'upcoming' ? getUpcomingShifts(shifts) :
    filter === 'past' ? getPastShifts(shifts) :
    shifts

  // Calculate statistics
  const upcomingShifts = getUpcomingShifts(shifts)
  const pastShifts = getPastShifts(shifts)
  const totalHoursWorked = calculateTotalHours(pastShifts)

  // Generate calendar URL
  const calendarUrl = employee?.id
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/calendar/${employee.id}/shifts.ics`
    : ''

  const handleCopyCalendarUrl = () => {
    if (calendarUrl) {
      navigator.clipboard.writeText(calendarUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRequestSwap = async (shift: Shift) => {
    setSelectedShift(shift)
    setShowSwapModal(true)
    setSwapNote('')
    setSwapError(null)
    setLoadingEligible(true)

    try {
      // Fetch eligible shifts from other employees on the same date
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          employee:employees(id, first_name, last_name)
        `)
        .eq('shift_date', shift.shift_date)
        .neq('employee_id', employee?.id)
        .gte('shift_date', new Date().toISOString().split('T')[0])

      if (error) throw error

      // Filter out shifts that already have pending swap requests
      const { data: existingSwaps } = await supabase
        .from('shift_swap_requests')
        .select('requester_shift_id, requested_shift_id')
        .in('status', ['pending_employee', 'pending_manager'])

      const swappedShiftIds = new Set([
        ...(existingSwaps?.map(s => s.requester_shift_id) || []),
        ...(existingSwaps?.map(s => s.requested_shift_id) || [])
      ])

      const available = (data || []).filter(s => !swappedShiftIds.has(s.id) && !swappedShiftIds.has(shift.id))
      setEligibleShifts(available)
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : 'Failed to load eligible shifts')
    } finally {
      setLoadingEligible(false)
    }
  }

  const handleSubmitSwap = async (targetShift: any) => {
    if (!selectedShift || !employee?.id || !restaurant?.id) return

    setSubmittingSwap(true)
    setSwapError(null)

    try {
      const { error } = await supabase
        .from('shift_swap_requests')
        .insert({
          restaurant_id: restaurant.id,
          requester_id: employee.id,
          requester_shift_id: selectedShift.id,
          requested_employee_id: targetShift.employee_id,
          requested_shift_id: targetShift.id,
          requester_notes: swapNote || null,
          status: 'pending_employee'
        })

      if (error) throw error

      setShowSwapModal(false)
      alert('Swap request sent successfully!')
      router.push('/dashboard/swap-requests')
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : 'Failed to submit swap request')
    } finally {
      setSubmittingSwap(false)
    }
  }

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
                <h1 className="text-xl font-semibold text-gray-900">My Shifts</h1>
                <p className="text-sm text-gray-500">{restaurant.name}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalendarModal(true)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Subscribe to Calendar
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Hours Worked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{totalHoursWorked.toFixed(1)}</div>
              <p className="text-sm text-gray-500">From {pastShifts.length} completed shift{pastShifts.length !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upcoming Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{upcomingShifts.length}</div>
              <p className="text-sm text-gray-500">Scheduled shift{upcomingShifts.length !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{shifts.length}</div>
              <p className="text-sm text-gray-500">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Shifts List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Shift History
                </CardTitle>
                <CardDescription>
                  View and track all your shifts
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <div className="flex gap-2">
                  <Button
                    variant={filter === 'upcoming' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('upcoming')}
                  >
                    Upcoming
                  </Button>
                  <Button
                    variant={filter === 'past' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('past')}
                  >
                    Past
                  </Button>
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    All
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {shiftsLoading ? (
              <div className="text-center py-12 text-gray-400">Loading your shifts...</div>
            ) : filteredShifts.length > 0 ? (
              <div className="space-y-3">
                {filteredShifts.map((shift) => {
                  const shiftHours = calculateShiftHours(shift.start_time, shift.end_time)
                  const isToday = isShiftToday(shift)
                  const isUpcoming = new Date(shift.shift_date) >= new Date()

                  return (
                    <div
                      key={shift.id}
                      className={`p-4 border rounded-lg transition-all duration-150 ${
                        isToday
                          ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-100'
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Calendar className={`w-5 h-5 ${isToday ? 'text-primary-600' : 'text-gray-400'}`} />
                            <div>
                              <p className="font-semibold text-gray-900">
                                {formatDateTrinidad(new Date(shift.shift_date))}
                              </p>
                              {isToday && (
                                <Badge className="bg-primary-600 text-white text-xs mt-1">Today</Badge>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 ml-8 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600">
                                {formatTimeTrinidad(shift.start_time)} - {formatTimeTrinidad(shift.end_time)}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="font-medium text-gray-700">{shiftHours.toFixed(1)} hours</span>
                            </div>

                            {shift.notes && (
                              <p className="text-sm text-gray-600 bg-white px-3 py-2 rounded border border-gray-200">
                                {shift.notes}
                              </p>
                            )}

                            {isUpcoming && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRequestSwap(shift)}
                                className="mt-2 text-xs"
                              >
                                <RotateCw className="w-3 h-3 mr-1" />
                                Request Swap
                              </Button>
                            )}
                          </div>
                        </div>

                        {shift.position && (
                          <Badge className="bg-primary-100 text-primary-800 ml-4">{shift.position}</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No {filter !== 'all' ? filter : ''} shifts
                </h3>
                <p className="text-gray-500">
                  {filter === 'upcoming' && "You don't have any upcoming shifts scheduled."}
                  {filter === 'past' && "You haven't completed any shifts yet."}
                  {filter === 'all' && "No shifts found."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar Subscription Modal */}
      {showCalendarModal && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setShowCalendarModal(false)}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <CardTitle>Subscribe to Your Shifts Calendar</CardTitle>
                    <CardDescription>
                      Add your work schedule to Google Calendar, Apple Calendar, or Outlook
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCalendarModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <Label className="text-gray-700 font-medium mb-2 block">Calendar URL</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={calendarUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCalendarUrl}
                    className="flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 mr-1 text-green-600" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">How to Subscribe:</h3>

                {/* Google Calendar */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white hover:border-primary-300 transition-colors">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs font-bold">G</span>
                    Google Calendar
                  </h4>
                  <ol className="text-sm text-gray-700 space-y-2 list-decimal ml-4">
                    <li>Open <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium">Google Calendar</a></li>
                    <li>Click the <strong>"+"</strong> next to "Other calendars" on the left</li>
                    <li>Select <strong>"From URL"</strong></li>
                    <li>Paste the calendar URL above</li>
                    <li>Click <strong>"Add calendar"</strong></li>
                  </ol>
                </div>

                {/* Apple Calendar */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white hover:border-primary-300 transition-colors">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-gray-800 text-white rounded flex items-center justify-center text-xs font-bold"></span>
                    Apple Calendar (Mac/iPhone)
                  </h4>
                  <ol className="text-sm text-gray-700 space-y-2 list-decimal ml-4">
                    <li>Open Calendar app</li>
                    <li>Go to <strong>File &gt; New Calendar Subscription</strong> (Mac) or <strong>Settings &gt; Calendar &gt; Accounts &gt; Add Account</strong> (iPhone)</li>
                    <li>Paste the calendar URL above</li>
                    <li>Click <strong>"Subscribe"</strong></li>
                    <li>Choose a name and color for your shifts calendar</li>
                  </ol>
                </div>

                {/* Outlook */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white hover:border-primary-300 transition-colors">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-700 text-white rounded flex items-center justify-center text-xs font-bold">O</span>
                    Microsoft Outlook
                  </h4>
                  <ol className="text-sm text-gray-700 space-y-2 list-decimal ml-4">
                    <li>Open Outlook Calendar</li>
                    <li>Click <strong>"Add calendar"</strong> &gt; <strong>"Subscribe from web"</strong></li>
                    <li>Paste the calendar URL above</li>
                    <li>Name your calendar and click <strong>"Import"</strong></li>
                  </ol>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Your calendar will automatically update when shifts are added, modified, or removed.
                  Updates may take a few hours to appear in your calendar app.
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={() => window.open(calendarUrl, '_blank')}
                  className="w-full"
                  size="lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download .ics File
                </Button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Or use the URL above to subscribe in your calendar app
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Swap Request Modal */}
      {showSwapModal && selectedShift && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setShowSwapModal(false)}
        >
          <Card
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCw className="w-5 h-5" />
                    Request Shift Swap
                  </CardTitle>
                  <CardDescription>
                    Select a shift from another employee to swap with
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSwapModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Your Shift */}
              <div className="mb-6">
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Your Shift:</Label>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-semibold text-gray-900">
                    {formatDateTrinidad(new Date(selectedShift.shift_date))}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatTimeTrinidad(selectedShift.start_time)} - {formatTimeTrinidad(selectedShift.end_time)}
                    <span className="text-gray-400 mx-2">•</span>
                    {calculateShiftHours(selectedShift.start_time, selectedShift.end_time).toFixed(1)} hours
                  </p>
                  {selectedShift.position && (
                    <Badge className="mt-2 bg-blue-100 text-blue-800">{selectedShift.position}</Badge>
                  )}
                </div>
              </div>

              {/* Note */}
              <div className="mb-6">
                <Label htmlFor="swapNote" className="text-sm font-medium text-gray-700 mb-2 block">
                  Reason for Swap (Optional)
                </Label>
                <textarea
                  id="swapNote"
                  value={swapNote}
                  onChange={(e) => setSwapNote(e.target.value)}
                  placeholder="e.g., Family emergency, doctor's appointment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>

              {/* Available Shifts */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Available Shifts to Swap With:
                </Label>

                {swapError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {swapError}
                  </div>
                )}

                {loadingEligible ? (
                  <div className="text-center py-12">
                    <RotateCw className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
                    <p className="text-gray-600 text-sm">Finding available shifts...</p>
                  </div>
                ) : eligibleShifts.length > 0 ? (
                  <div className="space-y-3">
                    {eligibleShifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {shift.employee.first_name} {shift.employee.last_name}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatTimeTrinidad(shift.start_time)} - {formatTimeTrinidad(shift.end_time)}
                              <span className="text-gray-400 mx-2">•</span>
                              {calculateShiftHours(shift.start_time, shift.end_time).toFixed(1)} hours
                            </p>
                            {shift.position && (
                              <Badge className="mt-2 bg-gray-100 text-gray-800 text-xs">{shift.position}</Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSubmitSwap(shift)}
                            disabled={submittingSwap}
                            className="ml-4"
                          >
                            {submittingSwap ? 'Requesting...' : 'Request Swap'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No Available Shifts</p>
                    <p className="text-sm text-gray-500 mt-1">
                      No other employees are scheduled on this date
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
