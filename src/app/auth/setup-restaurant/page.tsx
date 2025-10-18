'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Calendar, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

export default function SetupRestaurantPage() {
  const router = useRouter()
  const { user, refreshProfile } = useAuth()

  const [restaurantData, setRestaurantData] = useState({
    name: '',
    address: '',
    phone: '',
    timezone: 'America/Port_of_Spain'
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Pre-fill restaurant name from user metadata if available
  useEffect(() => {
    if (user?.user_metadata?.restaurant_name) {
      setRestaurantData(prev => ({
        ...prev,
        name: user.user_metadata.restaurant_name
      }))
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestaurantData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const validateForm = () => {
    if (!restaurantData.name) {
      return 'Please enter your business name'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!user) {
      setError('User not found. Please try logging in again.')
      return
    }

    setLoading(true)

    try {
      // Create restaurant record
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: restaurantData.name,
          owner_email: user.email!,
          timezone: restaurantData.timezone
        })
        .select()
        .single()

      if (restaurantError) {
        setError(`Failed to create business: ${restaurantError.message}`)
        return
      }

      // Create employee record for the manager
      const { error: employeeError } = await supabase
        .from('employees')
        .insert({
          restaurant_id: restaurant.id,
          user_id: user.id,
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          email: user.email!,
          phone: user.user_metadata?.phone || restaurantData.phone,
          role: 'manager',
          position: null,
          hire_date: new Date().toISOString().split('T')[0],
          status: 'active'
        })

      if (employeeError) {
        setError(`Failed to create manager profile: ${employeeError.message}`)
        return
      }

      setSuccess(true)

      // Refresh the user profile to get the new restaurant data
      await refreshProfile()

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)

    } catch (error) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Setup error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-success-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome to ShiftSync TT!</h2>
            <p className="text-gray-600">
              Your business has been set up successfully. You'll be redirected to your dashboard in a moment.
            </p>
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
              <span className="text-sm text-gray-500">Redirecting to dashboard...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Complete Your Setup</CardTitle>
          <CardDescription className="text-center">
            Let's get your business set up in ShiftSync TT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert className="alert-error">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={restaurantData.name}
                onChange={handleChange}
                placeholder="Your Business Name"
                className="input"
                required
              />
            </div>

            <div>
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                name="address"
                type="text"
                value={restaurantData.address}
                onChange={handleChange}
                placeholder="123 Frederick Street, Port of Spain"
                className="input"
              />
            </div>

            <div>
              <Label htmlFor="phone">Business Phone (Optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={restaurantData.phone}
                onChange={handleChange}
                placeholder="868-555-0123"
                className="input"
              />
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                name="timezone"
                value={restaurantData.timezone}
                onChange={(e) => setRestaurantData(prev => ({ ...prev, timezone: e.target.value }))}
                className="input"
              >
                <option value="America/Port_of_Spain">Trinidad & Tobago (Atlantic)</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>

            <Button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting Up Business...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}