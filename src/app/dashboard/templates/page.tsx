'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Clock, Trash2, Edit2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { FadeIn, StaggerContainer } from '@/components/animations'
import type { ShiftTemplate } from '@/lib/database.types'

export default function ShiftTemplatesPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
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

  // Fetch templates
  useEffect(() => {
    async function fetchTemplates() {
      if (!restaurant?.id) return

      try {
        const { data, error } = await supabase
          .from('shift_templates')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (error) throw error

        setTemplates(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates')
      } finally {
        setIsLoading(false)
      }
    }

    if (restaurant?.id) {
      fetchTemplates()
    }
  }, [restaurant?.id])

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const { error } = await supabase
        .from('shift_templates')
        .update({ is_active: false })
        .eq('id', templateId)

      if (error) throw error

      setTemplates(templates.filter(t => t.id !== templateId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    }
  }

  const formatTime = (timeString: string) => {
    // Convert 24-hour time to 12-hour format
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes}${ampm}`
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
              Only managers can manage shift templates.
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
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Shift Templates</h1>
              <p className="text-sm text-gray-500">{restaurant.name}</p>
            </div>
            <Button onClick={() => router.push('/dashboard/templates/add')}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <FadeIn>
            <Alert className="alert-error mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </FadeIn>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <FadeIn>
            <Card className="text-center py-12">
              <CardContent>
                <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Yet</h3>
                <p className="text-gray-600 mb-6">
                  Create reusable shift templates to speed up scheduling
                </p>
                <Button onClick={() => router.push('/dashboard/templates/add')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Template
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        ) : (
          <>
            <FadeIn className="mb-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Copy className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-900 mb-1">Quick Scheduling with Templates</h3>
                      <p className="text-sm text-blue-700">
                        Use these templates when creating shifts to quickly apply common shift patterns.
                        You can also copy previous week schedules from the Schedule page.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <FadeIn key={template.id}>
                  <Card className="hover-lift">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{template.name}</span>
                        <Clock className="w-5 h-5 text-primary-500 flex-shrink-0" />
                      </CardTitle>
                      <CardDescription>
                        {formatTime(template.start_time)} - {formatTime(template.end_time)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {template.position && (
                        <div className="mb-4">
                          <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 text-sm rounded-full">
                            {template.position.charAt(0).toUpperCase() + template.position.slice(1)}
                          </span>
                        </div>
                      )}

                      {template.notes && (
                        <p className="text-sm text-gray-600 mb-4">{template.notes}</p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/shifts/add?template=${template.id}`)}
                          className="flex-1"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Use Template
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </StaggerContainer>
          </>
        )}
      </div>
    </div>
  )
}
