'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Calendar, Check, X, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { FadeIn, StaggerContainer } from '@/components/animations'
import type { TimeOffRequestWithEmployee, TimeOffStatus } from '@/lib/database.types'

export default function TimeOffPage() {
  const router = useRouter()
  const { user, employee, restaurant, loading } = useAuth()
  const [requests, setRequests] = useState<TimeOffRequestWithEmployee[]>([])
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

  // Fetch time-off requests
  useEffect(() => {
    async function fetchRequests() {
      if (!restaurant?.id || !employee?.id) return

      try {
        let query = supabase
          .from('time_off_requests')
          .select(`
            *,
            employee:employees(id, first_name, last_name, email)
          `)
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })

        // If not manager, only show own requests
        if (!isManager) {
          query = query.eq('employee_id', employee.id)
        }

        const { data, error } = await query

        if (error) throw error

        setRequests(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load requests')
      } finally {
        setIsLoading(false)
      }
    }

    if (restaurant?.id && employee?.id) {
      fetchRequests()
    }
  }, [restaurant?.id, employee?.id, isManager])

  const handleApprove = async (requestId: string) => {
    if (!user?.id) return

    setProcessingId(requestId)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('time_off_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      // Update local state
      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: 'approved' as TimeOffStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString() }
          : req
      ))

      // TODO: Send notification to employee
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeny = async (requestId: string) => {
    if (!user?.id) return
    if (!confirm('Are you sure you want to deny this time-off request?')) return

    setProcessingId(requestId)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('time_off_requests')
        .update({
          status: 'denied',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      // Update local state
      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: 'denied' as TimeOffStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString() }
          : req
      ))

      // TODO: Send notification to employee
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny request')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return

    try {
      const { error: deleteError } = await supabase
        .from('time_off_requests')
        .delete()
        .eq('id', requestId)

      if (deleteError) throw deleteError

      setRequests(requests.filter(req => req.id !== requestId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete request')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-TT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200'
      case 'denied': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <Check className="w-4 h-4" />
      case 'denied': return <X className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const reviewedRequests = requests.filter(r => r.status !== 'pending')

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Time Off Requests</h1>
              <p className="text-sm text-gray-500">{restaurant.name}</p>
            </div>
            {!isManager && (
              <Button onClick={() => router.push('/dashboard/time-off/request')}>
                <Plus className="w-4 h-4 mr-2" />
                Request Time Off
              </Button>
            )}
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

        {isManager && pendingRequests.length > 0 && (
          <FadeIn className="mb-8">
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-900">
                  <AlertCircle className="w-5 h-5" />
                  Pending Approvals
                  <span className="ml-auto text-sm font-normal bg-yellow-200 px-2 py-1 rounded-full">
                    {pendingRequests.length}
                  </span>
                </CardTitle>
                <CardDescription className="text-yellow-700">
                  These requests need your review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaggerContainer className="space-y-4">
                  {pendingRequests.map((request) => (
                    <FadeIn key={request.id}>
                      <div className="bg-white border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium text-gray-900">
                                {request.employee.first_name} {request.employee.last_name}
                              </h3>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                                {getStatusIcon(request.status)}
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              <Calendar className="w-4 h-4 inline mr-1" />
                              {formatDate(request.start_date)} - {formatDate(request.end_date)}
                              <span className="ml-2 text-gray-500">
                                ({Math.ceil((new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                              </span>
                            </p>
                            <p className="text-sm text-gray-700">
                              <strong>Reason:</strong> {request.reason}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={processingId === request.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeny(request.id)}
                              disabled={processingId === request.id}
                              className="border-red-300 text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </StaggerContainer>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <FadeIn>
            <Card className="text-center py-12">
              <CardContent>
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Time Off Requests</h3>
                <p className="text-gray-600 mb-6">
                  {isManager
                    ? "Your employees haven't submitted any time-off requests yet"
                    : "You haven't requested any time off yet"}
                </p>
                {!isManager && (
                  <Button onClick={() => router.push('/dashboard/time-off/request')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Request Time Off
                  </Button>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        ) : (
          <>
            {reviewedRequests.length > 0 && (
              <FadeIn>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {isManager ? 'All Requests' : 'Request History'}
                    </CardTitle>
                    <CardDescription>
                      {isManager ? 'Approved and denied requests' : 'Your past time-off requests'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StaggerContainer className="space-y-4">
                      {reviewedRequests.map((request) => (
                        <FadeIn key={request.id}>
                          <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                {isManager && (
                                  <h3 className="font-medium text-gray-900 mb-2">
                                    {request.employee.first_name} {request.employee.last_name}
                                  </h3>
                                )}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                                    {getStatusIcon(request.status)}
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {formatDate(request.start_date)} - {formatDate(request.end_date)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700">{request.reason}</p>
                              </div>
                              {!isManager && request.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(request.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </FadeIn>
                      ))}
                    </StaggerContainer>
                  </CardContent>
                </Card>
              </FadeIn>
            )}

            {!isManager && pendingRequests.length > 0 && (
              <FadeIn className="mt-6">
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-900">Pending Requests</CardTitle>
                    <CardDescription className="text-blue-700">
                      Waiting for manager approval
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StaggerContainer className="space-y-4">
                      {pendingRequests.map((request) => (
                        <FadeIn key={request.id}>
                          <div className="bg-white border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                                    {getStatusIcon(request.status)}
                                    Pending
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {formatDate(request.start_date)} - {formatDate(request.end_date)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700">{request.reason}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(request.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </FadeIn>
                      ))}
                    </StaggerContainer>
                  </CardContent>
                </Card>
              </FadeIn>
            )}
          </>
        )}
      </div>
    </div>
  )
}
