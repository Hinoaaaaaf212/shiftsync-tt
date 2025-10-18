'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AUTH CALLBACK] Starting email verification callback...')

        // The Supabase client will automatically handle the PKCE flow
        // It will exchange the code for a session using the code_verifier from localStorage
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('[AUTH CALLBACK] Error getting session:', sessionError)
          setError(sessionError.message)
          setTimeout(() => router.push('/auth/login'), 3000)
          return
        }

        console.log('[AUTH CALLBACK] Session retrieved:', !!sessionData.session)

        // Check if we have a user now
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          console.error('[AUTH CALLBACK] Error getting user:', userError)
          setError('Verification failed. Please try again.')
          setTimeout(() => router.push('/auth/login'), 3000)
          return
        }

        console.log('[AUTH CALLBACK] User verified successfully:', user.email)
        console.log('[AUTH CALLBACK] Email confirmed at:', user.email_confirmed_at)

        // Success! Redirect to setup
        console.log('[AUTH CALLBACK] Redirecting to setup-restaurant')
        router.push('/auth/setup-restaurant')
      } catch (err) {
        console.error('[AUTH CALLBACK] Unexpected error:', err)
        setError('An unexpected error occurred')
        setTimeout(() => router.push('/auth/login'), 3000)
      }
    }

    handleCallback()
  }, [router])

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
