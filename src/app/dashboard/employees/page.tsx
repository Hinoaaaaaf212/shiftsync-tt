'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users, Search, Mail, Phone, Edit, Trash2, UserCheck, UserX, Key, Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDateTrinidad, formatCurrencyTTD } from '@/lib/date-utils'
import { Employee } from '@/lib/database.types'

interface EmployeeCredentials {
  email: string
  password: string
  employeeName: string
}

export default function EmployeesPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCredentials, setShowCredentials] = useState<EmployeeCredentials | null>(null)
  const [resettingPassword, setResettingPassword] = useState<string | null>(null)

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

  // Fetch employees
  useEffect(() => {
    if (!restaurant?.id) return

    const fetchEmployees = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        setEmployees(data || [])
        setFilteredEmployees(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load employees')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmployees()
  }, [restaurant?.id])

  // Filter employees based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEmployees(employees)
      return
    }

    const filtered = employees.filter(emp =>
      emp.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.position && emp.position.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    setFilteredEmployees(filtered)
  }, [searchQuery, employees])

  const handleToggleStatus = async (employeeId: string, currentIsActive: boolean) => {
    try {
      const newIsActive = !currentIsActive

      const { error } = await supabase
        .from('employees')
        .update({ is_active: newIsActive })
        .eq('id', employeeId)

      if (error) throw error

      // Update local state
      setEmployees(prev => prev.map(emp =>
        emp.id === employeeId ? { ...emp, is_active: newIsActive } : emp
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee status')
    }
  }

  const handleDeleteEmployee = async (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId)
    if (!employee) return

    if (!confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}? This will delete their employee record and login account. This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/employees/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employee.id,
          userId: employee.user_id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete employee')
      }

      // Update local state
      setEmployees(prev => prev.filter(emp => emp.id !== employeeId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee')
    }
  }

  const handleResetPassword = async (emp: Employee) => {
    if (!emp.user_id) {
      setError('This employee does not have a login account')
      return
    }

    if (!confirm(`Reset password for ${emp.first_name} ${emp.last_name}? A new temporary password will be generated.`)) {
      return
    }

    setResettingPassword(emp.id)
    try {
      const response = await fetch('/api/employees/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: emp.user_id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password')
      }

      // Show credentials modal
      setShowCredentials({
        email: emp.email,
        password: result.password,
        employeeName: `${emp.first_name} ${emp.last_name}`
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setResettingPassword(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
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

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Users className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading employees...</p>
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
              Only managers can access the employee management system.
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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Employee Management</h1>
                <p className="text-sm text-gray-500">{restaurant.name}</p>
              </div>
            </div>

            <Button onClick={() => router.push('/dashboard/employees/add')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert className="alert-error mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search and Stats */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Total: {employees.length}</span>
              <span>Active: {employees.filter(e => e.is_active).length}</span>
              <span>Inactive: {employees.filter(e => !e.is_active).length}</span>
            </div>
          </div>
        </div>

        {/* Employee List */}
        {isLoading ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading employees...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No employees found' : 'No employees yet'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery
                    ? 'Try adjusting your search terms or clear the search to see all employees.'
                    : 'Get started by adding your first employee to the team.'
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={() => router.push('/dashboard/employees/add')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Employee
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((employee) => (
              <Card key={employee.id} className="card">
                <CardHeader className="card-header">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="card-title text-base">
                        {employee.first_name} {employee.last_name}
                      </CardTitle>
                      <CardDescription>
                        Joined {formatDateTrinidad(employee.created_at)}
                      </CardDescription>
                    </div>
                    <Badge className={getRoleBadgeClass(employee.role)}>
                      {employee.role}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {employee.position && (
                      <p className="text-sm text-gray-600">{employee.position}</p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 truncate">{employee.email}</span>
                      </div>

                      {employee.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{employee.phone}</span>
                        </div>
                      )}

                      {employee.hourly_rate && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">💰</span>
                          <span className="text-gray-600">
                            {formatCurrencyTTD(employee.hourly_rate)}/hour
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <Badge className={employee.is_active ? 'badge-success' : 'badge-neutral'}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </Badge>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
                            title="Edit Employee"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(employee.id, employee.is_active)}
                            className={employee.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                            title={employee.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {employee.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteEmployee(employee.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {employee.user_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetPassword(employee)}
                          disabled={resettingPassword === employee.id}
                          className="w-full"
                        >
                          <Key className="w-3 h-3 mr-2" />
                          {resettingPassword === employee.id ? 'Resetting...' : 'Reset Password'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Trinidad-specific notice */}
        <Alert className="alert-info mt-8">
          <Users className="w-4 h-4" />
          <AlertDescription>
            <strong>Trinidad employment note:</strong> Remember to register new employees with the National Insurance Board (NIB) and ensure all employment contracts comply with local labor laws.
          </AlertDescription>
        </Alert>
      </div>

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-green-600">Password Reset Successful!</CardTitle>
                  <CardDescription>
                    New login credentials for {showCredentials.employeeName}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCredentials(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="alert-warning">
                <Key className="w-4 h-4" />
                <AlertDescription>
                  <strong>Important:</strong> Save these credentials now. You won't be able to see the password again after closing this window.
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={showCredentials.email}
                      readOnly
                      className="bg-white font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(showCredentials.email)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">New Temporary Password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={showCredentials.password}
                      readOnly
                      className="bg-white font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(showCredentials.password)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-3">
                  Share these credentials with the employee. They should change the password after logging in.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    copyToClipboard(`Email: ${showCredentials.email}\nPassword: ${showCredentials.password}`)
                  }}
                  className="flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Both
                </Button>
                <Button
                  onClick={() => setShowCredentials(null)}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}