'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, User, Save, Mail, Phone, Calendar, DollarSign, Edit, Trash2, UserCheck, UserX, Wallet, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDateTrinidad, formatCurrencyTTD } from '@/lib/date-utils'
import { getPayrollSummary } from '@/lib/payroll-utils'
import { exportPaySlipToPDF } from '@/lib/pdf-export'
import { Shift, Employee } from '@/lib/database.types'
import { startOfMonth, endOfMonth, startOfYear, format, parseISO } from 'date-fns'

interface EmployeeFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  position: string
  hourlyRate: string
  isActive: boolean
}

export default function EmployeeDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string
  const { user, employee: currentEmployee, restaurant, loading } = useAuth()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<EmployeeFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'employee',
    position: '',
    hourlyRate: '',
    isActive: true
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pay slip date range state
  const [payPeriodStart, setPayPeriodStart] = useState<string>('')
  const [payPeriodEnd, setPayPeriodEnd] = useState<string>('')

  // Initialize pay period dates to current month
  useEffect(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    setPayPeriodStart(format(monthStart, 'yyyy-MM-dd'))
    setPayPeriodEnd(format(monthEnd, 'yyyy-MM-dd'))
  }, [])

  // Redirect if not authenticated or not a manager
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
    if (!loading && user && !restaurant && !currentEmployee) {
      router.push('/auth/setup-restaurant')
    }
    if (!loading && currentEmployee && currentEmployee.role !== 'manager') {
      router.push('/dashboard')
    }
  }, [user, currentEmployee, restaurant, loading, router])

  // Fetch employee data
  useEffect(() => {
    if (!restaurant?.id || !employeeId) return

    const fetchEmployee = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('id', employeeId)
          .eq('restaurant_id', restaurant.id)
          .single()

        if (error) throw error

        if (!data) {
          setError('Employee not found')
          return
        }

        setEmployee(data)

        // Populate form data
        setFormData({
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
          phone: data.phone || '',
          role: data.role,
          position: data.position || '',
          hourlyRate: data.hourly_rate ? data.hourly_rate.toString() : '',
          isActive: data.is_active
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load employee')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmployee()
  }, [restaurant?.id, employeeId])

  // Fetch shifts for this employee
  useEffect(() => {
    if (!employeeId) return

    const fetchShifts = async () => {
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('employee_id', employeeId)
          .order('shift_date', { ascending: false })

        if (error) {
          console.error('Error fetching shifts:', error)
          return
        }

        setShifts(data || [])
      } catch (err) {
        console.error('Error in fetchShifts:', err)
      }
    }

    fetchShifts()
  }, [employeeId])

  const handleInputChange = (field: keyof EmployeeFormData, value: string | boolean) => {
    if (field === 'isActive' && typeof value === 'string') {
      setFormData(prev => ({ ...prev, [field]: value === 'true' }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
    setError(null)
  }

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'First name is required'
    if (!formData.lastName.trim()) return 'Last name is required'
    if (!formData.email.trim()) return 'Email is required'
    if (!formData.email.includes('@')) return 'Please enter a valid email address'
    if (!formData.role) return 'Role is required'

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

  const handleSave = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!employee) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Check if email already exists for another employee
      if (formData.email !== employee.email) {
        const { data: existingEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('email', formData.email.trim().toLowerCase())
          .eq('restaurant_id', restaurant!.id)
          .neq('id', employee.id)
          .single()

        if (existingEmployee) {
          setError('An employee with this email already exists')
          setIsSubmitting(false)
          return
        }
      }

      // Update the employee
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          position: formData.position.trim() || null,
          hourly_rate: formData.hourlyRate ? Number(formData.hourlyRate) : null,
          is_active: formData.isActive
        })
        .eq('id', employee.id)

      if (updateError) throw updateError

      // Update local state
      const updatedEmployee = {
        ...employee,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        role: formData.role,
        position: formData.position.trim() || null,
        hourly_rate: formData.hourlyRate ? Number(formData.hourlyRate) : null,
        is_active: formData.isActive
      }

      setEmployee(updatedEmployee)
      setIsEditing(false)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!employee) return

    const newIsActive = !employee.is_active

    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: newIsActive })
        .eq('id', employee.id)

      if (error) throw error

      setEmployee(prev => prev ? { ...prev, is_active: newIsActive } : null)
      setFormData(prev => ({ ...prev, isActive: newIsActive }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee status')
    }
  }

  const handleDelete = async () => {
    if (!employee) return

    if (!confirm('Are you sure you want to delete this employee? This will delete their employee record and login account. This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/employees/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          userId: employee.user_id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete employee')
      }

      router.push('/dashboard/employees')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee')
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'manager': return 'badge-manager'
      case 'server': return 'badge-server'
      case 'cook': return 'badge-cook'
      case 'bartender': return 'badge-bartender'
      case 'host': return 'badge-host'
      default: return 'badge-neutral'
    }
  }

  const handleExportPaySlip = async () => {
    if (!employee || !restaurant || !payPeriodStart || !payPeriodEnd) return

    // Parse selected date range
    const periodStart = parseISO(payPeriodStart)
    const periodEnd = parseISO(payPeriodEnd)
    const yearStart = startOfYear(periodEnd)

    try {
      // Fetch shifts for selected period
      const { data: periodShifts, error: periodError } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('shift_date', payPeriodStart)
        .lte('shift_date', payPeriodEnd)
        .order('shift_date', { ascending: true })

      if (periodError) throw periodError

      // Fetch year-to-date shifts for YTD calculations
      const { data: ytdShifts, error: ytdError } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('shift_date', yearStart.toISOString().split('T')[0])
        .order('shift_date', { ascending: true })

      if (ytdError) throw ytdError

      // Generate pay slip
      exportPaySlipToPDF({
        businessName: restaurant.name,
        businessAddress: restaurant.address || undefined,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        employeeId: employee.id,
        employeeRole: employee.role,
        employeePosition: employee.position || undefined,
        hourlyRate: employee.hourly_rate || 0,
        payPeriodStart: periodStart,
        payPeriodEnd: periodEnd,
        paymentDate: periodEnd, // Assume payment at end of period
        shifts: periodShifts || [],
        allYearShifts: ytdShifts || []
      })
    } catch (err) {
      console.error('Error generating pay slip:', err)
      setError('Failed to generate pay slip. Please try again.')
    }
  }

  if (loading || !user || !currentEmployee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <User className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading employee...</p>
        </div>
      </div>
    )
  }

  if (currentEmployee.role !== 'manager') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only managers can view employee details.
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading employee details...</p>
        </div>
      </div>
    )
  }

  if (error && !employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Employee Not Found</CardTitle>
            <CardDescription>
              The employee you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard/employees')} className="w-full">
              Back to Employees
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!employee) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/dashboard/employees')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Employees
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {employee.first_name} {employee.last_name}
                </h1>
                <p className="text-sm text-gray-500">{restaurant.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleToggleStatus}
                    className={employee.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                  >
                    {employee.is_active ? (
                      <>
                        <UserX className="w-4 h-4 mr-2" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert className="alert-error mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {isEditing ? 'Edit Employee' : 'Employee Details'}
                    </CardTitle>
                    <CardDescription>
                      {isEditing ? 'Update employee information' : 'View and manage employee information'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getRoleBadgeClass(employee.role)}>
                      {employee.role}
                    </Badge>
                    <Badge className={employee.is_active ? 'badge-success' : 'badge-neutral'}>
                      {employee.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="space-y-6">
                    {/* Edit Form */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
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
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="868-555-1234"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="role">Role *</Label>
                        <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                          <SelectTrigger>
                            <SelectValue />
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
                        <Label htmlFor="isActive">Status *</Label>
                        <Select value={formData.isActive ? 'true' : 'false'} onValueChange={(value) => handleInputChange('isActive', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Active</SelectItem>
                            <SelectItem value="false">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="position">Position/Title</Label>
                      <Input
                        id="position"
                        type="text"
                        value={formData.position}
                        onChange={(e) => handleInputChange('position', e.target.value)}
                        placeholder="e.g., Senior Server, Head Cook"
                      />
                    </div>

                    <div>
                      <Label htmlFor="hourlyRate">Hourly Rate (TTD)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          id="hourlyRate"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.hourlyRate}
                          onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                          placeholder="25.00"
                          className="pl-8"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false)
                          setError(null)
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="flex-1"
                      >
                        {isSubmitting ? (
                          'Saving...'
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* View Mode */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium">{employee.email}</p>
                          </div>
                        </div>

                        {employee.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-sm text-gray-500">Phone</p>
                              <p className="font-medium">{employee.phone}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-500">Joined</p>
                            <p className="font-medium">{formatDateTrinidad(employee.created_at)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {employee.position && (
                          <div>
                            <p className="text-sm text-gray-500">Position</p>
                            <p className="font-medium">{employee.position}</p>
                          </div>
                        )}

                        {employee.hourly_rate && (
                          <div className="flex items-center gap-3">
                            <DollarSign className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-sm text-gray-500">Hourly Rate</p>
                              <p className="font-medium">{formatCurrencyTTD(employee.hourly_rate)}/hour</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-sm text-gray-500">Employee Since</p>
                          <p className="font-medium">{formatDateTrinidad(employee.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Payroll Summary */}
            {employee.hourly_rate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Payroll Summary
                  </CardTitle>
                  <CardDescription>
                    Hours and earnings overview
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const payroll = getPayrollSummary(employee.id, shifts, employee.hourly_rate || 0)
                    return (
                      <div className="space-y-4">
                        {/* This Week */}
                        <div className="border-b border-gray-200 pb-4">
                          <p className="text-sm font-medium text-gray-500 mb-2">This Week</p>
                          <div className="flex items-baseline justify-between">
                            <p className="text-2xl font-bold text-gray-900">
                              {payroll.thisWeek.hours.toFixed(1)}h
                            </p>
                            <p className="text-lg font-semibold text-primary-600">
                              {formatCurrencyTTD(payroll.thisWeek.pay)}
                            </p>
                          </div>
                        </div>

                        {/* This Month */}
                        <div className="border-b border-gray-200 pb-4">
                          <p className="text-sm font-medium text-gray-500 mb-2">This Month</p>
                          <div className="flex items-baseline justify-between">
                            <p className="text-2xl font-bold text-gray-900">
                              {payroll.thisMonth.hours.toFixed(1)}h
                            </p>
                            <p className="text-lg font-semibold text-primary-600">
                              {formatCurrencyTTD(payroll.thisMonth.pay)}
                            </p>
                          </div>
                        </div>

                        {/* All Time */}
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">All Time</p>
                          <div className="flex items-baseline justify-between">
                            <p className="text-2xl font-bold text-gray-900">
                              {payroll.allTime.hours.toFixed(1)}h
                            </p>
                            <p className="text-lg font-semibold text-primary-600">
                              {formatCurrencyTTD(payroll.allTime.pay)}
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-3">
                            Hourly Rate: {formatCurrencyTTD(employee.hourly_rate)}/hour
                          </p>

                          {/* Pay Period Selection */}
                          <div className="space-y-3 mb-4">
                            <div>
                              <Label htmlFor="payPeriodStart" className="text-xs">
                                Pay Period Start
                              </Label>
                              <Input
                                id="payPeriodStart"
                                type="date"
                                value={payPeriodStart}
                                onChange={(e) => setPayPeriodStart(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label htmlFor="payPeriodEnd" className="text-xs">
                                Pay Period End
                              </Label>
                              <Input
                                id="payPeriodEnd"
                                type="date"
                                value={payPeriodEnd}
                                onChange={(e) => setPayPeriodEnd(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            className="w-full justify-center"
                            onClick={handleExportPaySlip}
                            size="sm"
                            disabled={!payPeriodStart || !payPeriodEnd}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export Pay Slip
                          </Button>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.location.href = `mailto:${employee.email}`}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </Button>

                {employee.phone && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => window.location.href = `tel:${employee.phone}`}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call Employee
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push(`/dashboard/schedule?employee=${employee.id}`)}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  View Schedule
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}