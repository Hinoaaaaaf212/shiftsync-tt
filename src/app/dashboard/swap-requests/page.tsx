'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RotateCw, Check, X, Clock, Calendar, AlertCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDateTrinidad, formatTimeTrinidad } from '@/lib/date-utils'
import type { ShiftSwapRequestWithDetails, ShiftSwapStatus } from '@/lib/database.types'

interface SwapRequest {
  id: string
  restaurant_id: string
  requester_id: string
  requester_shift_id: string
  requested_employee_id: string
  requested_shift_id: string
  status: ShiftSwapStatus
  requester_notes: string | null
  denial_reason: string | null
  employee_response_at: string | null
  manager_reviewed_by: string | null
  manager_reviewed_at: string | null
  created_at: string
  requester: {
    id: string
    first_name: string
    last_name: string
  }
  requester_shift: {
    shift_date: string
    start_time: string
    end_time: string
    position: string | null
  }
  requested_employee: {
    id: string
    first_name: string
    last_name: string
  }
  requested_shift: {
    shift_date: string
    start_time: string
    end_time: string
    position: string | null
  }
}

export default function SwapRequestsPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [requests, setRequests] = useState<SwapRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const isManager = employee?.role === 'manager'

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
    if (!loading && user && !restaurant && !employee) {
      router.push('/auth/setup-restaurant')
    }
  }, [user, employee, restaurant, loading, router])

  // Fetch swap requests
  useEffect(() => {
    async function fetchRequests() {
      if (!restaurant?.id || !employee?.id) return

      setIsLoading(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('shift_swap_requests')
          .select(`
            *,
            requester:requester_id(id, first_name, last_name),
            requester_shift:requester_shift_id(shift_date, start_time, end_time, position),
            requested_employee:requested_employee_id(id, first_name, last_name),
            requested_shift:requested_shift_id(shift_date, start_time, end_time, position)
          `)
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError

        setRequests(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load swap requests')
      } finally {
        setIsLoading(false)
      }
    }

    if (restaurant?.id && employee?.id) {
      fetchRequests()
    }
  }, [restaurant?.id, employee?.id])

  const handleEmployeeAccept = async (requestId: string) => {
    if (!employee?.id) return

    setProcessingId(requestId)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('shift_swap_requests')
        .update({
          status: 'pending_manager',
          employee_response_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      // Update local state
      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: 'pending_manager' as ShiftSwapStatus, employee_response_at: new Date().toISOString() }
          : req
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept swap request')
    } finally {
      setProcessingId(null)
    }
  }

  const handleEmployeeDeny = async (requestId: string) => {
    if (!employee?.id) return
    if (!confirm('Are you sure you want to decline this swap request?')) return

    setProcessingId(requestId)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('shift_swap_requests')
        .update({
          status: 'denied',
          employee_response_at: new Date().toISOString(),
          denial_reason: 'Declined by employee'
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: 'denied' as ShiftSwapStatus, employee_response_at: new Date().toISOString() }
          : req
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline swap request')
    } finally {
      setProcessingId(null)
    }
  }

  const handleManagerApprove = async (requestId: string) => {
    if (!user?.id) return

    setProcessingId(requestId)
    setError(null)

    try {
      // Call the execute_shift_swap function
      const { error: rpcError } = await supabase.rpc('execute_shift_swap', {
        p_swap_request_id: requestId
      })

      if (rpcError) throw rpcError

      // Update local state
      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: 'approved' as ShiftSwapStatus, manager_reviewed_by: user.id, manager_reviewed_at: new Date().toISOString() }
          : req
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve swap')
    } finally {
      setProcessingId(null)
    }
  }

  const handleManagerDeny = async (requestId: string) => {
    if (!user?.id) return

    const reason = prompt('Please provide a reason for denying this swap request:')
    if (!reason) return

    setProcessingId(requestId)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('shift_swap_requests')
        .update({
          status: 'denied',
          denial_reason: reason,
          manager_reviewed_by: user.id,
          manager_reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: 'denied' as ShiftSwapStatus, denial_reason: reason, manager_reviewed_by: user.id, manager_reviewed_at: new Date().toISOString() }
          : req
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny swap')
    } finally {
      setProcessingId(null)
    }
  }

  const handleCancel = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this swap request?')) return

    setProcessingId(requestId)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('shift_swap_requests')
        .delete()
        .eq('id', requestId)

      if (deleteError) throw deleteError

      setRequests(requests.filter(req => req.id !== requestId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request')
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusColor = (status: ShiftSwapStatus) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200'
      case 'denied': return 'bg-red-100 text-red-700 border-red-200'
      case 'cancelled': return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'pending_manager': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    }
  }

  const getStatusIcon = (status: ShiftSwapStatus) => {
    switch (status) {
      case 'approved': return <Check className="w-4 h-4" />
      case 'denied': return <X className="w-4 h-4" />
      case 'cancelled': return <X className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getStatusText = (status: ShiftSwapStatus) => {
    switch (status) {
      case 'pending_employee': return 'Waiting for Employee'
      case 'pending_manager': return 'Waiting for Manager'
      case 'approved': return 'Approved'
      case 'denied': return 'Denied'
      case 'cancelled': return 'Cancelled'
      default: return status
    }
  }

  if (loading || !user || !employee || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <RotateCw className="w-5 h-5 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Filter requests by status
  const pendingForEmployee = requests.filter(r =>
    r.status === 'pending_employee' && r.requested_employee_id === employee.id
  )
  const pendingForManager = requests.filter(r => r.status === 'pending_manager')
  const myRequests = requests.filter(r => r.requester_id === employee.id)
  const completedRequests = requests.filter(r => ['approved', 'denied', 'cancelled'].includes(r.status))

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
                <h1 className="text-xl font-semibold text-gray-900">Shift Swap Requests</h1>
                <p className="text-sm text-gray-500">{restaurant.name}</p>
              </div>
            </div>
            {!isManager && (
              <Button onClick={() => router.push('/dashboard/my-shifts')}>
                <Plus className="w-4 h-4 mr-2" />
                Request Swap
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert className="alert-error mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Pending for Employee (requests sent to you) */}
        {!isManager && pendingForEmployee.length > 0 && (
          <Card className="mb-6 bg-yellow-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <AlertCircle className="w-5 h-5" />
                Requests for You
                <span className="ml-auto text-sm font-normal bg-yellow-200 px-2 py-1 rounded-full">
                  {pendingForEmployee.length}
                </span>
              </CardTitle>
              <CardDescription className="text-yellow-700">
                Other employees want to swap shifts with you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingForEmployee.map((request) => (
                  <div key={request.id} className="bg-white border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {request.requester.first_name} {request.requester.last_name}
                          </h3>
                          <span className="text-gray-500">wants to swap</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          {/* Their shift (they're giving you) */}
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-xs font-medium text-blue-900 mb-1">They give you:</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDateTrinidad(new Date(request.requester_shift.shift_date))}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatTimeTrinidad(request.requester_shift.start_time)} - {formatTimeTrinidad(request.requester_shift.end_time)}
                            </p>
                            {request.requester_shift.position && (
                              <Badge className="mt-1 bg-blue-100 text-blue-800 text-xs">{request.requester_shift.position}</Badge>
                            )}
                          </div>

                          {/* Your shift (you're giving them) */}
                          <div className="p-3 bg-green-50 border border-green-200 rounded">
                            <p className="text-xs font-medium text-green-900 mb-1">You give them:</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDateTrinidad(new Date(request.requested_shift.shift_date))}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatTimeTrinidad(request.requested_shift.start_time)} - {formatTimeTrinidad(request.requested_shift.end_time)}
                            </p>
                            {request.requested_shift.position && (
                              <Badge className="mt-1 bg-green-100 text-green-800 text-xs">{request.requested_shift.position}</Badge>
                            )}
                          </div>
                        </div>

                        {request.requester_notes && (
                          <p className="text-sm text-gray-700 mt-3">
                            <strong>Note:</strong> {request.requester_notes}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleEmployeeAccept(request.id)}
                          disabled={processingId === request.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEmployeeDeny(request.id)}
                          disabled={processingId === request.id}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending for Manager */}
        {isManager && pendingForManager.length > 0 && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <AlertCircle className="w-5 h-5" />
                Pending Your Approval
                <span className="ml-auto text-sm font-normal bg-blue-200 px-2 py-1 rounded-full">
                  {pendingForManager.length}
                </span>
              </CardTitle>
              <CardDescription className="text-blue-700">
                Both employees agreed to swap
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingForManager.map((request) => (
                  <div key={request.id} className="bg-white border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-medium text-gray-900">
                            {request.requester.first_name} {request.requester.last_name}
                          </h3>
                          <RotateCw className="w-4 h-4 text-gray-400" />
                          <h3 className="font-medium text-gray-900">
                            {request.requested_employee.first_name} {request.requested_employee.last_name}
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                            <p className="text-xs font-medium text-gray-600 mb-1">
                              {request.requester.first_name}'s current shift:
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDateTrinidad(new Date(request.requester_shift.shift_date))}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatTimeTrinidad(request.requester_shift.start_time)} - {formatTimeTrinidad(request.requester_shift.end_time)}
                            </p>
                          </div>

                          <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                            <p className="text-xs font-medium text-gray-600 mb-1">
                              {request.requested_employee.first_name}'s current shift:
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDateTrinidad(new Date(request.requested_shift.shift_date))}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatTimeTrinidad(request.requested_shift.start_time)} - {formatTimeTrinidad(request.requested_shift.end_time)}
                            </p>
                          </div>
                        </div>

                        {request.requester_notes && (
                          <p className="text-sm text-gray-700 mt-3">
                            <strong>Reason:</strong> {request.requester_notes}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleManagerApprove(request.id)}
                          disabled={processingId === request.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManagerDeny(request.id)}
                          disabled={processingId === request.id}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Requests (for employees) */}
        {!isManager && myRequests.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>My Swap Requests</CardTitle>
              <CardDescription>
                Requests you've initiated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            {getStatusText(request.status)}
                          </span>
                          <span className="text-sm text-gray-600">
                            with {request.requested_employee.first_name} {request.requested_employee.last_name}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                          <div className="text-sm">
                            <p className="text-gray-500">Your shift:</p>
                            <p className="font-medium text-gray-900">
                              {formatDateTrinidad(new Date(request.requester_shift.shift_date))} • {formatTimeTrinidad(request.requester_shift.start_time)}-{formatTimeTrinidad(request.requester_shift.end_time)}
                            </p>
                          </div>
                          <div className="text-sm">
                            <p className="text-gray-500">Their shift:</p>
                            <p className="font-medium text-gray-900">
                              {formatDateTrinidad(new Date(request.requested_shift.shift_date))} • {formatTimeTrinidad(request.requested_shift.start_time)}-{formatTimeTrinidad(request.requested_shift.end_time)}
                            </p>
                          </div>
                        </div>

                        {request.denial_reason && (
                          <p className="text-sm text-red-600 mt-2">
                            <strong>Reason:</strong> {request.denial_reason}
                          </p>
                        )}
                      </div>

                      {request.status === 'pending_employee' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(request.id)}
                          disabled={processingId === request.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Requests (for managers) */}
        {isManager && completedRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Request History</CardTitle>
              <CardDescription>
                All completed swap requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        {getStatusText(request.status)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {request.requester.first_name} {request.requester.last_name} ↔ {request.requested_employee.first_name} {request.requested_employee.last_name}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDateTrinidad(new Date(request.created_at))}
                    </div>
                    {request.denial_reason && (
                      <p className="text-sm text-red-600 mt-1">
                        Reason: {request.denial_reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {isLoading ? (
          <div className="text-center py-12">
            <RotateCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading swap requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <RotateCw className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Swap Requests</h3>
              <p className="text-gray-600 mb-6">
                {isManager
                  ? "No employees have requested shift swaps yet"
                  : "You haven't requested any shift swaps yet"}
              </p>
              {!isManager && (
                <Button onClick={() => router.push('/dashboard/my-shifts')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Request a Swap
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
