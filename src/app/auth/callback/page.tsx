'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    console.log('[AUTH CALLBACK] Page loaded')
    console.log('[AUTH CALLBACK] Supabase will automatically handle PKCE code exchange')
  }, [])

  // Wait for auth state to update, then redirect
  useEffect(() => {
    if (loading) {
      console.log('[AUTH CALLBACK] Waiting for auth state...')
      return
    }

    if (hasRedirected) {
      return
    }

    if (user) {
      console.log('[AUTH CALLBACK] User authenticated:', user.email)
      console.log('[AUTH CALLBACK] Email confirmed at:', user.email_confirmed_at)
      console.log('[AUTH CALLBACK] Redirecting to setup-restaurant...')

      setHasRedirected(true)
      router.push('/auth/setup-restaurant')
    } else {
      console.error('[AUTH CALLBACK] No user found after auth callback')
      setError('Email verification failed. Please try signing up again.')
      setTimeout(() => router.push('/auth/sign-up'), 3000)
    }
  }, [user, loading, router, hasRedirected])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Verification Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-900">Verifying your email...</h2>
            <p className="text-gray-600">Please wait while we confirm your account.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
