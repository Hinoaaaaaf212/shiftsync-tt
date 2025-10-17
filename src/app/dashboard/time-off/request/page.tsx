'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

interface TimeOffFormData {
  startDate: string
  endDate: string
  reason: string
}

export default function RequestTimeOffPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [formData, setFormData] = useState<TimeOffFormData>({
    startDate: '',
    endDate: '',
    reason: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
    if (!loading && user && !restaurant && !employee) {
      router.push('/auth/setup-restaurant')
    }
    // Managers should use the main time-off page
    if (!loading && employee && employee.role === 'manager') {
      router.push('/dashboard/time-off')
    }
  }, [user, employee, restaurant, loading, router])

  const handleInputChange = (field: keyof TimeOffFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const validateForm = (): string | null => {
    if (!formData.startDate) return 'Start date is required'
    if (!formData.endDate) return 'End date is required'
    if (!formData.reason.trim()) return 'Reason is required'

    // Check if start date is in the past
    const startDate = new Date(formData.startDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (startDate < today) {
      return 'Start date cannot be in the past'
    }

    // Check if end date is before start date
    const endDate = new Date(formData.endDate)
    if (endDate < startDate) {
      return 'End date must be on or after start date'
    }

    // Check if date range is too long (e.g., max 30 days)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 30) {
      return 'Time off requests cannot exceed 30 days. Please submit separate requests.'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!restaurant?.id || !employee?.id) {
      setError('Restaurant or employee information not found')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('time_off_requests')
        .insert({
          restaurant_id: restaurant.id,
          employee_id: employee.id,
          start_date: formData.startDate,
          end_date: formData.endDate,
          reason: formData.reason.trim(),
          status: 'pending'
        })

      if (insertError) throw insertError

      // TODO: Send notification to manager

      router.push('/dashboard/time-off')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-TT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0
    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (employee.role === 'manager') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Managers should review time-off requests on the Time Off page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard/time-off')} className="w-full">
              Go to Time Off Requests
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
              onClick={() => router.push('/dashboard/time-off')}
              className="text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Time Off
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Request Time Off</h1>
              <p className="text-sm text-gray-500">{restaurant.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Time Off Request
            </CardTitle>
            <CardDescription>
              Submit a request for time off from work
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert className="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Date Range */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.startDate && formatDate(formData.startDate)}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      min={formData.startDate || new Date().toISOString().split('T')[0]}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.endDate && formatDate(formData.endDate)}
                    </p>
                  </div>
                </div>

                {formData.startDate && formData.endDate && (
                  <Alert className="alert-info">
                    <Calendar className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Duration:</strong> {calculateDays()} {calculateDays() === 1 ? 'day' : 'days'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Reason */}
              <div>
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder="Please provide a reason for your time-off request (e.g., vacation, personal matter, medical appointment)"
                  rows={4}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.reason.length}/500 characters
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/time-off')}
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
                    'Submitting Request...'
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Alert */}
        <Alert className="alert-info mt-6">
          <Calendar className="w-4 h-4" />
          <AlertDescription>
            <strong>Note:</strong> Your manager will review this request. You'll be notified once it's approved or denied.
            Time-off requests should be submitted at least 48 hours in advance when possible.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
