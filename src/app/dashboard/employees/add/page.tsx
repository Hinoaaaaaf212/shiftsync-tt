'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

interface EmployeeFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: 'manager' | 'server' | 'cook' | 'bartender' | 'host' | 'employee'
  position: string
  hourlyRate: string
  hireDate: string
}

export default function AddEmployeePage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [formData, setFormData] = useState<EmployeeFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'employee',
    position: '',
    hourlyRate: '',
    hireDate: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [employeeCredentials, setEmployeeCredentials] = useState<{ email: string; password: string } | null>(null)

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

  const handleInputChange = (field: keyof EmployeeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'First name is required'
    if (!formData.lastName.trim()) return 'Last name is required'
    if (!formData.email.trim()) return 'Email is required'
    if (!formData.email.includes('@')) return 'Please enter a valid email address'
    if (!formData.role) return 'Role is required'
    if (!formData.hireDate) return 'Hire date is required'

    // Validate Trinidad phone number format (optional field)
    if (formData.phone.trim() && !formData.phone.match(/^(\+1[-.\s]?)?868[-.\s]?\d{3}[-.\s]?\d{4}$/)) {
      return 'Please enter a valid Trinidad phone number (e.g., 868-555-1234)'
    }

    // Validate hourly rate (optional field)
    if (formData.hourlyRate && (isNaN(Number(formData.hourlyRate)) || Number(formData.hourlyRate) < 0)) {
      return 'Please enter a valid hourly rate'
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
      // Check if email already exists in this restaurant
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('email', formData.email.trim().toLowerCase())
        .eq('restaurant_id', restaurant.id)
        .single()

      if (existingEmployee) {
        setError('An employee with this email already exists')
        setIsSubmitting(false)
        return
      }

      // Generate temporary password
      const tempPassword = `Welcome${Math.floor(Math.random() * 10000)}!`
      const email = formData.email.trim().toLowerCase()

      // Call API route to create employee with auth user
      const response = await fetch('/api/employees/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: tempPassword,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
          position: formData.position.trim(),
          hourlyRate: formData.hourlyRate,
          hireDate: formData.hireDate,
          restaurantId: restaurant.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.error?.includes('already registered') || result.error?.includes('User already registered')) {
          setError('This email is already registered in the system')
        } else {
          setError(`Failed to create employee account: ${result.error || 'Unknown error'}`)
        }
        setIsSubmitting(false)
        return
      }

      // Store credentials to show to manager
      setEmployeeCredentials({
        email: email,
        password: tempPassword
      })

      setSuccess(true)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add employee')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-5 h-5 text-white animate-pulse" />
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
              Only managers can add employees.
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
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-green-600">Employee Added Successfully!</CardTitle>
            <CardDescription>
              The new employee has been added to your team and their login account has been created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {employeeCredentials && (
              <>
                <Alert className="alert-info">
                  <UserPlus className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Important:</strong> Share these login credentials with the employee. They can use these to log in and view their shifts.
                  </AlertDescription>
                </Alert>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-gray-900">Employee Login Credentials</h3>

                  <div>
                    <Label className="text-gray-600">Email</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={employeeCredentials.email}
                        readOnly
                        className="bg-white font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(employeeCredentials.email)
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-600">Temporary Password</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={employeeCredentials.password}
                        readOnly
                        className="bg-white font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(employeeCredentials.password)
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-4">
                    The employee should change this password after their first login. Login URL: {window.location.origin}/auth/login
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/employees/add')}
                className="flex-1"
              >
                Add Another Employee
              </Button>
              <Button
                onClick={() => router.push('/dashboard/employees')}
                className="flex-1"
              >
                View All Employees
              </Button>
            </div>
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
              onClick={() => router.push('/dashboard/employees')}
              className="text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Employees
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Add New Employee</h1>
              <p className="text-sm text-gray-500">{restaurant.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Employee Information
            </CardTitle>
            <CardDescription>
              Add a new team member to {restaurant.name}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert className="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Personal Information */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Smith"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="john.smith@restaurant.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="868-555-1234"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Trinidad format: 868-555-1234
                  </p>
                </div>
              </div>

              {/* Job Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Job Details</h3>

                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="cook">Cook</SelectItem>
                      <SelectItem value="bartender">Bartender</SelectItem>
                      <SelectItem value="host">Host</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="position">Position/Title (Optional)</Label>
                  <Input
                    id="position"
                    type="text"
                    value={formData.position}
                    onChange={(e) => handleInputChange('position', e.target.value)}
                    placeholder="e.g., Senior Server, Head Cook, Assistant Manager"
                  />
                </div>

                <div>
                  <Label htmlFor="hourlyRate">Hourly Rate (Optional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">TTD $</span>
                    <Input
                      id="hourlyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.hourlyRate}
                      onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                      placeholder="25.00"
                      className="pl-12"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Trinidad minimum wage: TTD $17.50/hour (as of 2024)
                  </p>
                </div>

                <div>
                  <Label htmlFor="hireDate">Hire Date *</Label>
                  <Input
                    id="hireDate"
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => handleInputChange('hireDate', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/employees')}
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
                    'Adding Employee...'
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Add Employee
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Trinidad-specific notice */}
        <Alert className="alert-info mt-6">
          <UserPlus className="w-4 h-4" />
          <AlertDescription>
            <strong>Trinidad employment reminder:</strong> New employees must be registered with NIB within 7 days of hire. Ensure work permits are valid for non-citizens.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}