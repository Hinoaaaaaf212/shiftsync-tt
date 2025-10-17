'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, Plus, Trash2, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

interface EmployeePreferences {
  employee_id: string
  target_monthly_hours: number
  preferred_shift_start_time: string | null
  preferred_shift_length_hours: number | null
  max_days_per_week: number
  prefers_weekends: boolean
  notes: string | null
}

interface EmployeeAvailability {
  id: string
  employee_id: string
  restaurant_id: string
  day_of_week: number | null
  specific_date: string | null
  unavailable_start_time: string | null
  unavailable_end_time: string | null
  is_all_day: boolean
  reason: string | null
  is_recurring: boolean
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function PreferencesPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()

  // Preferences state
  const [preferences, setPreferences] = useState<EmployeePreferences>({
    employee_id: '',
    target_monthly_hours: 160,
    preferred_shift_start_time: null,
    preferred_shift_length_hours: null,
    max_days_per_week: 6,
    prefers_weekends: true,
    notes: null
  })

  // Availability blocks state
  const [availabilityBlocks, setAvailabilityBlocks] = useState<EmployeeAvailability[]>([])

  // UI state
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showAddBlockForm, setShowAddBlockForm] = useState(false)

  // New block form state
  const [newBlock, setNewBlock] = useState({
    type: 'recurring' as 'recurring' | 'specific',
    day_of_week: 0,
    specific_date: '',
    is_all_day: true,
    start_time: '09:00',
    end_time: '17:00',
    reason: ''
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Redirect to setup if no employee
  useEffect(() => {
    if (!loading && user && !employee) {
      router.push('/auth/setup-restaurant')
    }
  }, [user, employee, loading, router])

  // Load preferences
  useEffect(() => {
    async function loadPreferences() {
      if (!employee?.id) return

      try {
        const { data, error } = await supabase
          .from('employee_preferences')
          .select('*')
          .eq('employee_id', employee.id)
          .maybeSingle()

        if (error) {
          console.error('Error loading preferences:', error)
        } else if (data) {
          setPreferences(data)
        } else {
          // Set default with employee_id
          setPreferences(prev => ({ ...prev, employee_id: employee.id }))
        }
      } catch (err) {
        console.error('Failed to load preferences:', err)
      }
    }

    if (employee?.id && !loading) {
      loadPreferences()
    }
  }, [employee?.id, loading])

  // Load availability blocks
  useEffect(() => {
    async function loadAvailability() {
      if (!employee?.id) return

      try {
        const { data, error } = await supabase
          .from('employee_availability')
          .select('*')
          .eq('employee_id', employee.id)
          .order('day_of_week', { ascending: true })

        if (error) {
          console.error('Error loading availability:', error)
        } else {
          setAvailabilityBlocks(data || [])
        }
      } catch (err) {
        console.error('Failed to load availability:', err)
      }
    }

    if (employee?.id && !loading) {
      loadAvailability()
    }
  }, [employee?.id, loading])

  const handleSavePreferences = async () => {
    if (!employee?.id || !restaurant?.id) return

    setSaving(true)
    setMessage(null)

    try {
      // Validate
      if (preferences.target_monthly_hours < 40 || preferences.target_monthly_hours > 200) {
        setMessage({ type: 'error', text: 'Monthly hours must be between 40 and 200' })
        setSaving(false)
        return
      }

      if (preferences.max_days_per_week < 1 || preferences.max_days_per_week > 7) {
        setMessage({ type: 'error', text: 'Max days per week must be between 1 and 7' })
        setSaving(false)
        return
      }

      const { error } = await supabase
        .from('employee_preferences')
        .upsert({
          ...preferences,
          employee_id: employee.id
        })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save preferences' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddBlock = async () => {
    if (!employee?.id || !restaurant?.id) return

    try {
      const blockData: any = {
        employee_id: employee.id,
        restaurant_id: restaurant.id,
        is_all_day: newBlock.is_all_day,
        reason: newBlock.reason || null
      }

      if (newBlock.type === 'recurring') {
        blockData.day_of_week = newBlock.day_of_week
        blockData.is_recurring = true
        blockData.specific_date = null
      } else {
        blockData.specific_date = newBlock.specific_date
        blockData.is_recurring = false
        blockData.day_of_week = null
      }

      if (!newBlock.is_all_day) {
        blockData.unavailable_start_time = newBlock.start_time
        blockData.unavailable_end_time = newBlock.end_time
      }

      const { data, error } = await supabase
        .from('employee_availability')
        .insert(blockData)
        .select()
        .single()

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setAvailabilityBlocks([...availabilityBlocks, data])
        setShowAddBlockForm(false)
        setNewBlock({
          type: 'recurring',
          day_of_week: 0,
          specific_date: '',
          is_all_day: true,
          start_time: '09:00',
          end_time: '17:00',
          reason: ''
        })
        setMessage({ type: 'success', text: 'Unavailability block added!' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add block' })
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from('employee_availability')
        .delete()
        .eq('id', blockId)

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setAvailabilityBlocks(availabilityBlocks.filter(b => b.id !== blockId))
        setMessage({ type: 'success', text: 'Block removed!' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete block' })
    }
  }

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading your preferences...</p>
        </div>
      </div>
    )
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
                <h1 className="text-xl font-semibold text-gray-900">My Preferences</h1>
                <p className="text-sm text-gray-500">Manage your scheduling preferences</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Work Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Work Preferences
              </CardTitle>
              <CardDescription>
                Set your ideal work schedule and monthly hour targets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Monthly Hour Target */}
              <div>
                <Label htmlFor="target_hours">Monthly Hour Target</Label>
                <Input
                  id="target_hours"
                  type="number"
                  min="40"
                  max="200"
                  value={preferences.target_monthly_hours}
                  onChange={(e) => setPreferences({ ...preferences, target_monthly_hours: parseInt(e.target.value) || 160 })}
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many hours you'd like to work per month (40-200 hours)
                </p>
              </div>

              {/* Preferred Shift Start Time */}
              <div>
                <Label htmlFor="shift_start">Preferred Shift Start Time</Label>
                <Input
                  id="shift_start"
                  type="time"
                  value={preferences.preferred_shift_start_time || ''}
                  onChange={(e) => setPreferences({ ...preferences, preferred_shift_start_time: e.target.value || null })}
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your ideal time to start a shift (optional)
                </p>
              </div>

              {/* Preferred Shift Length */}
              <div>
                <Label htmlFor="shift_length">Preferred Shift Length (hours)</Label>
                <Input
                  id="shift_length"
                  type="number"
                  min="4"
                  max="12"
                  step="0.5"
                  value={preferences.preferred_shift_length_hours || ''}
                  onChange={(e) => setPreferences({ ...preferences, preferred_shift_length_hours: parseFloat(e.target.value) || null })}
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your ideal shift length (4-12 hours, optional)
                </p>
              </div>

              {/* Max Days Per Week */}
              <div>
                <Label htmlFor="max_days">Maximum Days Per Week</Label>
                <Input
                  id="max_days"
                  type="number"
                  min="1"
                  max="7"
                  value={preferences.max_days_per_week}
                  onChange={(e) => setPreferences({ ...preferences, max_days_per_week: parseInt(e.target.value) || 6 })}
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of days you can work per week (1-7)
                </p>
              </div>

              {/* Weekend Preference */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="weekends" className="text-base font-medium">
                    Available for Weekend Shifts
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">
                    Indicate if you prefer to work on weekends
                  </p>
                </div>
                <Button
                  id="weekends"
                  variant={preferences.prefers_weekends ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreferences({ ...preferences, prefers_weekends: !preferences.prefers_weekends })}
                >
                  {preferences.prefers_weekends ? 'Yes' : 'No'}
                </Button>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <textarea
                  id="notes"
                  value={preferences.notes || ''}
                  onChange={(e) => setPreferences({ ...preferences, notes: e.target.value || null })}
                  className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Any additional scheduling preferences..."
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSavePreferences}
                disabled={saving}
                className="w-full"
                size="lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </CardContent>
          </Card>

          {/* Unavailability Blocks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Unavailability Schedule
              </CardTitle>
              <CardDescription>
                Set times when you're unable to work
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Existing Blocks */}
              <div className="space-y-3 mb-4">
                {availabilityBlocks.length > 0 ? (
                  availabilityBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="p-4 border border-gray-200 rounded-lg bg-red-50 hover:border-red-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-red-100 text-red-800">
                              {block.is_recurring ? 'Recurring' : 'One-time'}
                            </Badge>
                            {block.is_all_day && (
                              <Badge className="bg-gray-100 text-gray-800">All Day</Badge>
                            )}
                          </div>

                          <p className="font-medium text-gray-900">
                            {block.is_recurring && block.day_of_week !== null
                              ? `Every ${DAYS_OF_WEEK[block.day_of_week]}`
                              : block.specific_date
                                ? new Date(block.specific_date).toLocaleDateString('en-TT', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })
                                : 'Unknown'
                            }
                          </p>

                          {!block.is_all_day && block.unavailable_start_time && block.unavailable_end_time && (
                            <p className="text-sm text-gray-600 mt-1">
                              {block.unavailable_start_time} - {block.unavailable_end_time}
                            </p>
                          )}

                          {block.reason && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              {block.reason}
                            </p>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No unavailability blocks set</p>
                  </div>
                )}
              </div>

              {/* Add New Block Form */}
              {showAddBlockForm ? (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Add Unavailability Block</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddBlockForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>

                  {/* Block Type */}
                  <div className="flex gap-2">
                    <Button
                      variant={newBlock.type === 'recurring' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewBlock({ ...newBlock, type: 'recurring' })}
                      className="flex-1"
                    >
                      Recurring Weekly
                    </Button>
                    <Button
                      variant={newBlock.type === 'specific' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewBlock({ ...newBlock, type: 'specific' })}
                      className="flex-1"
                    >
                      Specific Date
                    </Button>
                  </div>

                  {/* Day/Date Selection */}
                  {newBlock.type === 'recurring' ? (
                    <div>
                      <Label>Day of Week</Label>
                      <select
                        value={newBlock.day_of_week}
                        onChange={(e) => setNewBlock({ ...newBlock, day_of_week: parseInt(e.target.value) })}
                        className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {DAYS_OF_WEEK.map((day, idx) => (
                          <option key={day} value={idx}>{day}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={newBlock.specific_date}
                        onChange={(e) => setNewBlock({ ...newBlock, specific_date: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  )}

                  {/* All Day Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                    <Label>Unavailable All Day</Label>
                    <Button
                      variant={newBlock.is_all_day ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewBlock({ ...newBlock, is_all_day: !newBlock.is_all_day })}
                    >
                      {newBlock.is_all_day ? 'Yes' : 'No'}
                    </Button>
                  </div>

                  {/* Time Range (if not all day) */}
                  {!newBlock.is_all_day && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={newBlock.start_time}
                          onChange={(e) => setNewBlock({ ...newBlock, start_time: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={newBlock.end_time}
                          onChange={(e) => setNewBlock({ ...newBlock, end_time: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <Label>Reason (optional)</Label>
                    <Input
                      value={newBlock.reason}
                      onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                      placeholder="e.g., School, other job, personal..."
                      className="mt-1.5"
                    />
                  </div>

                  {/* Add Button */}
                  <Button
                    onClick={handleAddBlock}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Block
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowAddBlockForm(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Unavailability Block
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-900 mb-2">How Preferences Work</p>
                <ul className="space-y-1 list-disc ml-4">
                  <li>Your preferences help the AI scheduler create shifts that match your needs</li>
                  <li>Unavailability blocks are <strong>hard constraints</strong> - you won't be scheduled during these times</li>
                  <li>Other preferences (like target hours and shift times) are <strong>soft preferences</strong> - the scheduler will try to match them but may adjust if needed</li>
                  <li>Changes to your preferences will apply to future schedules generated by managers</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
