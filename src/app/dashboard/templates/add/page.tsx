'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

interface TemplateFormData {
  name: string
  startTime: string
  endTime: string
  position: string
  notes: string
}

export default function AddTemplatePage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    position: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleInputChange = (field: keyof TemplateFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Template name is required'
    if (!formData.startTime) return 'Start time is required'
    if (!formData.endTime) return 'End time is required'

    // Validate time range
    if (formData.startTime >= formData.endTime) {
      return 'End time must be after start time'
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

    if (!restaurant?.id) {
      setError('Restaurant information not found')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('shift_templates')
        .insert({
          restaurant_id: restaurant.id,
          name: formData.name.trim(),
          start_time: formData.startTime,
          end_time: formData.endTime,
          position: formData.position || null,
          notes: formData.notes.trim() || null,
          is_active: true
        })

      if (insertError) throw insertError

      router.push('/dashboard/templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
      setIsSubmitting(false)
    }
  }

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Clock className="w-5 h-5 text-white animate-pulse" />
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
              Only managers can create shift templates.
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
              onClick={() => router.push('/dashboard/templates')}
              className="text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Templates
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Create Shift Template</h1>
              <p className="text-sm text-gray-500">{restaurant.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Template Information
            </CardTitle>
            <CardDescription>
              Create a reusable shift template for faster scheduling
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert className="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Template Details */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Morning Server, Evening Cook, Weekend Host"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Choose a descriptive name to easily identify this template
                  </p>
                </div>

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
                  </div>
                </div>

                <div>
                  <Label htmlFor="position">Position (Optional)</Label>
                  <Select value={formData.position} onValueChange={(value) => handleInputChange('position', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="cook">Cook</SelectItem>
                      <SelectItem value="bartender">Bartender</SelectItem>
                      <SelectItem value="host">Host</SelectItem>
                      <SelectItem value="dishwasher">Dishwasher</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank if this template applies to multiple positions
                  </p>
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Add any notes about this shift template (e.g., 'Includes lunch break', 'Busy shift')"
                    rows={3}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/templates')}
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
                    'Creating Template...'
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Template
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Alert */}
        <Alert className="alert-info mt-6">
          <Clock className="w-4 h-4" />
          <AlertDescription>
            <strong>Tip:</strong> Templates are reusable shift patterns. Create templates for your most common shifts
            (e.g., morning, evening, weekend) to speed up your scheduling process.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
