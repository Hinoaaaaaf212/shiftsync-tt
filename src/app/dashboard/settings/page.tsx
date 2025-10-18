'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Settings, Save, Trash2, Plus, Calendar, Clock, Users, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDateTrinidad } from '@/lib/date-utils'

interface BlockedDate {
  id: string
  date: string
  reason: string
}

interface BusinessHours {
  id: string
  restaurant_id: string
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

interface StaffingRequirement {
  id: string
  restaurant_id: string
  day_of_week: number
  time_slot_start: string
  time_slot_end: string
  min_staff_required: number
  optimal_staff: number
  position_requirements: Record<string, number> | null
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function SettingsPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantAddress, setRestaurantAddress] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Blocked dates state
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [newBlockedReason, setNewBlockedReason] = useState('')
  const [isAddingBlockedDate, setIsAddingBlockedDate] = useState(false)

  // Business hours state
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([])
  const [savingBusinessHours, setSavingBusinessHours] = useState(false)

  // Staffing requirements state
  const [staffingRequirements, setStaffingRequirements] = useState<StaffingRequirement[]>([])
  const [showAddStaffing, setShowAddStaffing] = useState(false)
  const [newStaffing, setNewStaffing] = useState({
    day_of_week: 0,
    time_slot_start: '09:00',
    time_slot_end: '17:00',
    min_staff_required: 1,
    optimal_staff: 2
  })

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

  // Initialize restaurant name and address
  useEffect(() => {
    if (restaurant?.name) {
      setRestaurantName(restaurant.name)
    }
    if (restaurant?.address) {
      setRestaurantAddress(restaurant.address)
    }
  }, [restaurant])

  // Fetch blocked dates
  useEffect(() => {
    async function fetchBlockedDates() {
      if (!restaurant?.id) return

      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('date', { ascending: true })

      if (error) {
        console.error('Error fetching blocked dates:', error)
      } else {
        setBlockedDates(data || [])
      }
    }

    if (restaurant?.id) {
      fetchBlockedDates()
    }
  }, [restaurant])

  // Fetch business hours
  useEffect(() => {
    async function fetchBusinessHours() {
      if (!restaurant?.id) return

      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('day_of_week', { ascending: true })

      if (error) {
        console.error('[Settings] Error fetching business hours:', error)
      } else {
        console.log('[Settings] Fetched business hours:', {
          count: data?.length || 0,
          data
        })

        // Initialize default business hours if none exist
        if (!data || data.length === 0) {
          const defaultHours: BusinessHours[] = []
          for (let day = 0; day < 7; day++) {
            defaultHours.push({
              id: `temp-${day}`, // Temporary ID, will be replaced on save
              restaurant_id: restaurant.id,
              day_of_week: day,
              open_time: day >= 5 ? '10:00' : '09:00', // Sat-Sun: 10am, Mon-Fri: 9am
              close_time: day >= 5 ? '23:00' : '22:00', // Sat-Sun: 11pm, Mon-Fri: 10pm
              is_closed: false
            })
          }
          console.log('[Settings] Initialized default business hours:', defaultHours)
          setBusinessHours(defaultHours)
        } else {
          setBusinessHours(data)
        }
      }
    }

    if (restaurant?.id) {
      fetchBusinessHours()
    }
  }, [restaurant])

  // Fetch staffing requirements
  useEffect(() => {
    async function fetchStaffingRequirements() {
      if (!restaurant?.id) return

      const { data, error } = await supabase
        .from('staffing_requirements')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('day_of_week', { ascending: true })
        .order('time_slot_start', { ascending: true })

      if (error) {
        console.error('Error fetching staffing requirements:', error)
      } else {
        setStaffingRequirements(data || [])
      }
    }

    if (restaurant?.id) {
      fetchStaffingRequirements()
    }
  }, [restaurant])

  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!restaurantName.trim()) {
      setError('Restaurant name is required')
      return
    }

    if (!restaurant?.id) {
      setError('Restaurant information not found')
      return
    }

    setIsUpdating(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({
          name: restaurantName.trim(),
          address: restaurantAddress.trim() || null
        })
        .eq('id', restaurant.id)

      if (updateError) throw updateError

      setSuccess('Restaurant information updated successfully!')

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload()
      }, 1500)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update restaurant')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddBlockedDate = async () => {
    if (!newBlockedDate || !newBlockedReason.trim()) {
      setError('Please provide both date and reason for blocking')
      return
    }

    if (!restaurant?.id) {
      setError('Restaurant information not found')
      return
    }

    // Check if date is in the past
    const selectedDate = new Date(newBlockedDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      setError('Cannot block dates in the past')
      return
    }

    setIsAddingBlockedDate(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error: insertError } = await supabase
        .from('blocked_dates')
        .insert({
          restaurant_id: restaurant.id,
          date: newBlockedDate,
          reason: newBlockedReason.trim()
        })
        .select()
        .single()

      if (insertError) throw insertError

      setBlockedDates([...blockedDates, data])
      setNewBlockedDate('')
      setNewBlockedReason('')
      setSuccess('Blocked date added successfully!')

    } catch (err) {
      if (err instanceof Error && err.message.includes('duplicate')) {
        setError('This date is already blocked')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add blocked date')
      }
    } finally {
      setIsAddingBlockedDate(false)
    }
  }

  const handleDeleteBlockedDate = async (id: string) => {
    if (!confirm('Are you sure you want to remove this blocked date?')) return

    setError(null)
    setSuccess(null)

    try {
      const { error: deleteError } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setBlockedDates(blockedDates.filter(bd => bd.id !== id))
      setSuccess('Blocked date removed successfully!')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove blocked date')
    }
  }

  const handleUpdateBusinessHours = async (dayIndex: number, field: string, value: any) => {
    const updatedHours = [...businessHours]
    const dayHours = updatedHours.find(h => h.day_of_week === dayIndex)

    if (dayHours) {
      // Update existing entry
      (dayHours as any)[field] = value
      setBusinessHours(updatedHours)
    } else {
      // Create new entry if it doesn't exist
      const newEntry: BusinessHours = {
        id: `temp-${dayIndex}`,
        restaurant_id: restaurant?.id || '',
        day_of_week: dayIndex,
        open_time: '09:00',
        close_time: '22:00',
        is_closed: false
      }
      ;(newEntry as any)[field] = value
      setBusinessHours([...updatedHours, newEntry])
    }
  }

  const handleSaveBusinessHours = async () => {
    if (!restaurant?.id) return

    setSavingBusinessHours(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('[Settings] Saving business hours:', {
        count: businessHours.length,
        hours: businessHours
      })

      if (businessHours.length === 0) {
        setError('No business hours to save. Please configure at least one day.')
        setSavingBusinessHours(false)
        return
      }

      // Prepare data for upsert, removing temporary IDs
      const dataToSave = businessHours.map(h => {
        const record: any = {
          restaurant_id: restaurant.id,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed
        }

        // Only include ID if it's not a temporary one
        if (h.id && !h.id.startsWith('temp-')) {
          record.id = h.id
        }

        return record
      })

      const { error: upsertError } = await supabase
        .from('business_hours')
        .upsert(dataToSave, {
          onConflict: 'restaurant_id,day_of_week'
        })

      if (upsertError) {
        console.error('[Settings] Error saving business hours:', upsertError)
        throw upsertError
      }

      setSuccess('Business hours updated successfully!')

      // Reload business hours to confirm
      const { data: reloadedData } = await supabase
        .from('business_hours')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('day_of_week', { ascending: true })

      console.log('[Settings] Reloaded business hours:', reloadedData)

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update business hours')
    } finally {
      setSavingBusinessHours(false)
    }
  }

  const handleAddStaffingRequirement = async () => {
    if (!restaurant?.id) return

    setError(null)
    setSuccess(null)

    try {
      const { data, error: insertError } = await supabase
        .from('staffing_requirements')
        .insert({
          restaurant_id: restaurant.id,
          ...newStaffing
        })
        .select()
        .single()

      if (insertError) throw insertError

      setStaffingRequirements([...staffingRequirements, data])
      setShowAddStaffing(false)
      setNewStaffing({
        day_of_week: 0,
        time_slot_start: '09:00',
        time_slot_end: '17:00',
        min_staff_required: 1,
        optimal_staff: 2
      })
      setSuccess('Staffing requirement added successfully!')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staffing requirement')
    }
  }

  const handleDeleteStaffingRequirement = async (id: string) => {
    if (!confirm('Are you sure you want to remove this staffing requirement?')) return

    setError(null)
    setSuccess(null)

    try {
      const { error: deleteError } = await supabase
        .from('staffing_requirements')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setStaffingRequirements(staffingRequirements.filter(sr => sr.id !== id))
      setSuccess('Staffing requirement removed successfully!')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove staffing requirement')
    }
  }

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Settings className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading settings...</p>
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
              Only managers can access settings.
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
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Restaurant Settings</h1>
              <p className="text-sm text-gray-500">{restaurant.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {error && (
          <Alert className="alert-error mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="alert-success mb-6">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Restaurant Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Restaurant Information
            </CardTitle>
            <CardDescription>
              Manage your restaurant's basic information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateRestaurant} className="space-y-4">
              <div>
                <Label htmlFor="restaurantName">Restaurant Name *</Label>
                <Input
                  id="restaurantName"
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Your Restaurant Name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="restaurantAddress">Business Address</Label>
                <textarea
                  id="restaurantAddress"
                  value={restaurantAddress}
                  onChange={(e) => setRestaurantAddress(e.target.value)}
                  placeholder="e.g., 123 Main Street, Port of Spain, Trinidad and Tobago"
                  className="input min-h-[80px] resize-y"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Full business address for official documents (e.g., pay slips)
                </p>
              </div>

              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  type="text"
                  value={restaurant.timezone || 'America/Port_of_Spain'}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Trinidad & Tobago timezone (Atlantic Standard Time)
                </p>
              </div>

              <div>
                <Label htmlFor="createdAt">Account Created</Label>
                <Input
                  id="createdAt"
                  type="text"
                  value={formatDateTrinidad(new Date(restaurant.created_at))}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  'Updating...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Blocked Dates Management */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Blocked Dates
            </CardTitle>
            <CardDescription>
              Manage blocked dates when shifts cannot be scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Add New Blocked Date */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Blocked Date</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="blockedDate">Date</Label>
                  <Input
                    id="blockedDate"
                    type="date"
                    value={newBlockedDate}
                    onChange={(e) => setNewBlockedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="blockedReason">Reason</Label>
                  <Input
                    id="blockedReason"
                    type="text"
                    value={newBlockedReason}
                    onChange={(e) => setNewBlockedReason(e.target.value)}
                    placeholder="e.g., Staff Training Day"
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                onClick={handleAddBlockedDate}
                disabled={isAddingBlockedDate || !newBlockedDate || !newBlockedReason}
              >
                {isAddingBlockedDate ? (
                  'Adding...'
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Blocked Date
                  </>
                )}
              </Button>
            </div>

            {/* Blocked Dates List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Blocked Dates</h3>
              {blockedDates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No blocked dates added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {blockedDates.map((blockedDate) => (
                    <div
                      key={blockedDate.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatDateTrinidad(new Date(blockedDate.date))}
                        </p>
                        <p className="text-sm text-gray-600">{blockedDate.reason}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBlockedDate(blockedDate.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Alert className="alert-info mt-4">
              <Calendar className="w-4 h-4" />
              <AlertDescription>
                <strong>Note:</strong> Blocked dates will prevent shifts from being scheduled. Use this feature for holidays, staff training days, or restaurant closures.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Business Hours Configuration */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Business Hours
            </CardTitle>
            <CardDescription>
              Set your restaurant's operating hours for each day of the week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DAYS_OF_WEEK.map((day, index) => {
                const dayHours = businessHours.find(h => h.day_of_week === index)
                return (
                  <div key={day} className="grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 rounded-lg">
                    <div className="col-span-3">
                      <Label className="text-sm font-medium">{day}</Label>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="time"
                        value={dayHours?.open_time || '09:00'}
                        onChange={(e) => handleUpdateBusinessHours(index, 'open_time', e.target.value)}
                        disabled={dayHours?.is_closed}
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-1 text-center text-gray-500">to</div>
                    <div className="col-span-3">
                      <Input
                        type="time"
                        value={dayHours?.close_time || '22:00'}
                        onChange={(e) => handleUpdateBusinessHours(index, 'close_time', e.target.value)}
                        disabled={dayHours?.is_closed}
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button
                        variant={dayHours?.is_closed ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleUpdateBusinessHours(index, 'is_closed', !dayHours?.is_closed)}
                        className="w-full text-xs"
                      >
                        {dayHours?.is_closed ? 'Closed' : 'Open'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            <Button
              onClick={handleSaveBusinessHours}
              disabled={savingBusinessHours}
              className="w-full mt-6"
            >
              {savingBusinessHours ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Business Hours
                </>
              )}
            </Button>

            <Alert className="mt-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                These hours will be used by the AI scheduler to generate shifts within your operating times.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Staffing Requirements */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Staffing Requirements
            </CardTitle>
            <CardDescription>
              Define minimum and optimal staff needed for different time periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Existing Requirements */}
            <div className="space-y-3 mb-4">
              {staffingRequirements.length > 0 ? (
                staffingRequirements.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary-100 text-primary-800">
                          {DAYS_OF_WEEK[req.day_of_week]}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {req.time_slot_start} - {req.time_slot_end}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="text-gray-700">
                          <strong>Min:</strong> {req.min_staff_required} staff
                        </span>
                        <span className="text-gray-700">
                          <strong>Optimal:</strong> {req.optimal_staff} staff
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStaffingRequirement(req.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No staffing requirements configured</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Add requirements to help the AI scheduler optimize staffing levels
                  </p>
                </div>
              )}
            </div>

            {/* Add New Requirement Form */}
            {showAddStaffing ? (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">Add Staffing Requirement</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddStaffing(false)}
                  >
                    Cancel
                  </Button>
                </div>

                <div>
                  <Label>Day of Week</Label>
                  <select
                    value={newStaffing.day_of_week}
                    onChange={(e) => setNewStaffing({ ...newStaffing, day_of_week: parseInt(e.target.value) })}
                    className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={day} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={newStaffing.time_slot_start}
                      onChange={(e) => setNewStaffing({ ...newStaffing, time_slot_start: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={newStaffing.time_slot_end}
                      onChange={(e) => setNewStaffing({ ...newStaffing, time_slot_end: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Minimum Staff</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newStaffing.min_staff_required}
                      onChange={(e) => setNewStaffing({ ...newStaffing, min_staff_required: parseInt(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Optimal Staff</Label>
                    <Input
                      type="number"
                      min={newStaffing.min_staff_required}
                      value={newStaffing.optimal_staff}
                      onChange={(e) => setNewStaffing({ ...newStaffing, optimal_staff: parseInt(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAddStaffingRequirement}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Requirement
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowAddStaffing(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Staffing Requirement
              </Button>
            )}

            <Alert className="mt-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                The AI scheduler will try to meet optimal staffing levels while ensuring minimum requirements are always met.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your account and access details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ownerEmail">Owner Email</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={restaurant.owner_email}
                disabled
                className="bg-gray-100"
              />
            </div>

            <div>
              <Label htmlFor="role">Your Role</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="role"
                  type="text"
                  value={employee.role}
                  disabled
                  className="bg-gray-100 capitalize"
                />
                <Badge className="bg-primary-100 text-primary-800">
                  {employee.role === 'manager' ? 'Full Access' : 'Limited Access'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>
              Navigate to other management pages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/employees')}
              >
                Manage Employees
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/schedule')}
              >
                View Schedule
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/shifts/add')}
              >
                Add New Shift
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone - Delete Account */}
        <Card className="border-red-200 bg-red-50 mt-6">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-red-700">
              Permanent deletion options - these actions cannot be undone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Delete Business (Manager Only) */}
            {employee.role === 'manager' && restaurant.owner_email === employee.email && (
              <div className="pb-6 border-b border-red-200">
                <h3 className="text-sm font-semibold text-red-900 mb-3">Delete Business</h3>
                <Alert className="bg-red-100 border-red-300 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Warning:</strong> Deleting your business will permanently remove:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All employee records and their accounts</li>
                      <li>All shifts, schedules, and templates</li>
                      <li>All time-off requests and swap requests</li>
                      <li>Business hours and staffing requirements</li>
                      <li>The business itself and all associated data</li>
                    </ul>
                    <p className="mt-2 font-semibold">After deleting the business, you'll be able to delete your own account.</p>
                  </AlertDescription>
                </Alert>

                <Button
                  variant="outline"
                  className="w-full bg-red-700 text-white hover:bg-red-800 border-red-700"
                  onClick={async () => {
                    if (!confirm('Are you absolutely sure you want to delete your entire business and ALL associated data? This will affect all your employees and cannot be undone.\n\nType DELETE BUSINESS in the next prompt to confirm.')) {
                      return
                    }

                    const confirmation = prompt('Type DELETE BUSINESS to confirm:')
                    if (confirmation !== 'DELETE BUSINESS') {
                      alert('Business deletion cancelled. You must type DELETE BUSINESS exactly to confirm.')
                      return
                    }

                    setError(null)
                    setSuccess(null)
                    setIsUpdating(true)

                    try {
                      const response = await fetch('/api/restaurant/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          restaurantId: restaurant.id,
                          ownerEmail: restaurant.owner_email
                        })
                      })

                      const result = await response.json()

                      if (!response.ok) {
                        throw new Error(result.error || 'Failed to delete business')
                      }

                      // Sign out and redirect to home
                      await supabase.auth.signOut()
                      router.push('/')
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to delete business')
                      setIsUpdating(false)
                    }
                  }}
                  disabled={isUpdating}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isUpdating ? 'Deleting Business...' : 'Delete Business & All Data'}
                </Button>
              </div>
            )}

            {/* Delete Personal Account */}
            <div>
              <h3 className="text-sm font-semibold text-red-900 mb-3">Delete Personal Account</h3>
              <Alert className="bg-red-100 border-red-300 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Warning:</strong> Deleting your account will permanently remove:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Your employee profile and login access</li>
                    <li>Your shift assignments and availability preferences</li>
                    <li>All associated personal information</li>
                    {employee.role === 'manager' && restaurant.owner_email === employee.email && (
                      <li className="font-semibold text-red-900">⚠️ You must delete the business first (see above)</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>

              <Button
                variant="outline"
                className="w-full bg-red-600 text-white hover:bg-red-700 border-red-600"
                onClick={async () => {
                  if (!confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.\n\nType DELETE in the next prompt to confirm.')) {
                    return
                  }

                  const confirmation = prompt('Type DELETE to confirm account deletion:')
                  if (confirmation !== 'DELETE') {
                    alert('Account deletion cancelled. You must type DELETE exactly to confirm.')
                    return
                  }

                  setError(null)
                  setSuccess(null)
                  setIsUpdating(true)

                  try {
                    const response = await fetch('/api/employees/delete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: user.id,
                        employeeId: employee.id
                      })
                    })

                    const result = await response.json()

                    if (!response.ok) {
                      throw new Error(result.error || 'Failed to delete account')
                    }

                    // Sign out and redirect to home
                    await supabase.auth.signOut()
                    router.push('/')
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete account')
                    setIsUpdating(false)
                  }
                }}
                disabled={isUpdating}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isUpdating ? 'Deleting Account...' : 'Delete My Account'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trinidad-specific notice */}
        <Alert className="alert-info mt-6">
          <Settings className="w-4 h-4" />
          <AlertDescription>
            <strong>Trinidad business compliance:</strong> Ensure your restaurant operations comply with local labor laws, health regulations, and business licensing requirements.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
