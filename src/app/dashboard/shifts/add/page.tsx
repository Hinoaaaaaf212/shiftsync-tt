'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Save, Clock, Calendar, AlertTriangle, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Shift, ShiftTemplate } from '@/lib/database.types'
import {
  getCommonShiftTimes,
  calculateShiftHours,
  formatTimeTrinidad,
  formatDateTrinidad
} from '@/lib/date-utils'
import {
  detectShiftConflicts,
  ShiftConflict
} from '@/lib/conflict-utils'

export const dynamic = 'force-dynamic'

interface Employee {
  id: string
  first_name: string
  last_name: string
  role: string
  position: string | null
}

interface ShiftFormData {
  employeeId: string
  shiftDate: string
  startTime: string
  endTime: string
  position: string
  notes: string
}

function AddShiftPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, employee, restaurant, loading } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [allShifts, setAllShifts] = useState<Shift[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [formData, setFormData] = useState<ShiftFormData>({
    employeeId: '',
    shiftDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD for date input
    startTime: '09:00',
    endTime: '17:00',
    position: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [shiftHours, setShiftHours] = useState<number>(0)
  const [conflicts, setConflicts] = useState<ShiftConflict[]>([])

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

  // Fetch active employees
  useEffect(() => {
    async function fetchEmployees() {
      if (!restaurant?.id) return

      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, role, position')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'active')
        .order('first_name', { ascending: true })

      if (error) {
        console.error('Error fetching employees:', error)
        setError('Failed to load employees')
      } else {
        setEmployees(data || [])
      }
    }

    if (restaurant?.id) {
      fetchEmployees()
    }
  }, [restaurant])

  // Fetch all shifts for conflict detection
  useEffect(() => {
    async function fetchShifts() {
      if (!restaurant?.id) return

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('restaurant_id', restaurant.id)

      if (error) {
        console.error('Error fetching shifts:', error)
      } else {
        setAllShifts(data || [])
      }
    }

    if (restaurant?.id) {
      fetchShifts()
    }
  }, [restaurant])

  // Fetch shift templates
  useEffect(() => {
    async function fetchTemplates() {
      if (!restaurant?.id) return

      const { data, error } = await supabase
        .from('shift_templates')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching templates:', error)
      } else {
        setTemplates(data || [])
      }
    }

    if (restaurant?.id) {
      fetchTemplates()
    }
  }, [restaurant])

  // Load template from URL if specified
  useEffect(() => {
    const templateId = searchParams.get('template')
    if (templateId && templates.length > 0) {
      const template = templates.find(t => t.id === templateId)
      if (template) {
        setFormData(prev => ({
          ...prev,
          startTime: template.start_time,
          endTime: template.end_time,
          position: template.position || '',
          notes: template.notes || ''
        }))
      }
    }
  }, [searchParams, templates])

  // Calculate shift hours when times change
  useEffect(() => {
    if (formData.startTime && formData.endTime) {
      const hours = calculateShiftHours(formData.startTime, formData.endTime)
      setShiftHours(hours)
    }
  }, [formData.startTime, formData.endTime])

  // Real-time conflict detection
  useEffect(() => {
    if (!formData.employeeId || !formData.shiftDate || !formData.startTime || !formData.endTime) {
      setConflicts([])
      return
    }

    const detectedConflicts = detectShiftConflicts(
      formData.employeeId,
      formData.shiftDate,
      formData.startTime,
      formData.endTime,
      allShifts
    )

    setConflicts(detectedConflicts)
  }, [formData.employeeId, formData.shiftDate, formData.startTime, formData.endTime, allShifts])

  const handleInputChange = (field: keyof ShiftFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleQuickShift = (shiftTemplate: { label: string; start: string; end: string }) => {
    setFormData(prev => ({
      ...prev,
      startTime: shiftTemplate.start,
      endTime: shiftTemplate.end
    }))
  }

  const handleApplyTemplate = (template: ShiftTemplate) => {
    setFormData(prev => ({
      ...prev,
      startTime: template.start_time,
      endTime: template.end_time,
      position: template.position || '',
      notes: template.notes || ''
    }))
  }

  const validateForm = async (): Promise<string | null> => {
    if (!formData.employeeId) return 'Please select an employee'
    if (!formData.shiftDate) return 'Please select a shift date'
    if (!formData.startTime) return 'Please select a start time'
    if (!formData.endTime) return 'Please select an end time'

    // Check if date is in the past
    const selectedDate = new Date(formData.shiftDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      return 'Cannot create shifts in the past'
    }

    // Validate shift hours (minimum 1 hour, maximum 16 hours)
    const hours = calculateShiftHours(formData.startTime, formData.endTime)
    if (hours < 1) {
      return 'Shift must be at least 1 hour long'
    }
    if (hours > 16) {
      return 'Shift cannot be longer than 16 hours'
    }

    // Check for conflicts using the real-time detected conflicts
    if (conflicts.length > 0) {
      return 'This shift conflicts with an existing shift. Please adjust the time or choose a different employee.'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = await validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!restaurant?.id) {
      setError('Restaurant information not found')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('shifts')
        .insert({
          employee_id: formData.employeeId,
          restaurant_id: restaurant.id,
          shift_date: formData.shiftDate,
          start_time: formData.startTime,
          end_time: formData.endTime,
          position: formData.position.trim() || null,
          notes: formData.notes.trim() || null
        })

      if (insertError) throw insertError

      setSuccess(true)

      // Redirect to schedule page after a short delay
      setTimeout(() => {
        router.push('/dashboard/schedule')
      }, 1500)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shift')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Plus className="w-5 h-5 text-white animate-pulse" />
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
              Only managers can create shifts.
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-green-600">Shift Created Successfully!</CardTitle>
            <CardDescription>
              The shift has been added to the schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard/schedule')} className="w-full">
              View Schedule
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (employees.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-gray-50">
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
                <h1 className="text-xl font-semibold text-gray-900">Add New Shift</h1>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>No Employees Available</CardTitle>
              <CardDescription>
                You need to add employees before creating shifts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/dashboard/employees/add')} className="w-full">
                Add Your First Employee
              </Button>
            </CardContent>
          </Card>
        </div>
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
              <h1 className="text-xl font-semibold text-gray-900">Add New Shift</h1>
              <p className="text-sm text-gray-500">{restaurant.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Schedule a Shift
            </CardTitle>
            <CardDescription>
              Assign a shift to an employee
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert className="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Employee Selection */}
              <div>
                <Label htmlFor="employee">Employee *</Label>
                <Select value={formData.employeeId} onValueChange={(value) => handleInputChange('employeeId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} - {emp.role}
                        {emp.position && ` (${emp.position})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Selection */}
              <div>
                <Label htmlFor="shiftDate">Shift Date *</Label>
                <Input
                  id="shiftDate"
                  type="date"
                  value={formData.shiftDate}
                  onChange={(e) => handleInputChange('shiftDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  DD/MM/YYYY format: {formData.shiftDate && formatDateTrinidad(formData.shiftDate)}
                </p>
              </div>

              {/* Custom Templates */}
              {templates.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Your Shift Templates</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/dashboard/templates')}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Manage Templates
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyTemplate(template)}
                        className="text-xs justify-start"
                      >
                        <Copy className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{template.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Shift Templates */}
              <div>
                <Label>Quick Shift Templates</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {getCommonShiftTimes().map((template) => (
                    <Button
                      key={template.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickShift(template)}
                      className="text-xs"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {template.label}
                      <span className="ml-1 text-gray-500">
                        ({formatTimeTrinidad(template.start)} - {formatTimeTrinidad(template.end)})
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimeTrinidad(formData.startTime)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimeTrinidad(formData.endTime)}
                  </p>
                </div>
              </div>

              {/* Conflict Warning */}
              {conflicts.length > 0 && (
                <Alert className="alert-error">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Shift Conflict Detected:</strong>
                    <div className="mt-2 space-y-1">
                      {conflicts.map((conflict, index) => (
                        <div key={index} className="text-sm">
                          • {conflict.message}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Shift Duration Display */}
              {shiftHours > 0 && conflicts.length === 0 && (
                <Alert className="alert-info">
                  <Clock className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Shift Duration:</strong> {shiftHours.toFixed(1)} hours
                  </AlertDescription>
                </Alert>
              )}

              {/* Position */}
              <div>
                <Label htmlFor="position">Position/Role (Optional)</Label>
                <Input
                  id="position"
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  placeholder="e.g., Server, Cook, Bartender"
                />
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  type="text"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any additional information about this shift"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    'Creating Shift...'
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Shift
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Shift scheduling notice */}
        <Alert className="alert-info mt-6">
          <Calendar className="w-4 h-4" />
          <AlertDescription>
            <strong>Shift scheduling:</strong> You can block specific dates from the Settings page to prevent shifts from being scheduled on those days.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

export default function AddShiftPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Plus className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AddShiftPageContent />
    </Suspense>
  )
}
