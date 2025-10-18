import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Log that callback was hit
  console.log('[AUTH CALLBACK] Hit callback route')
  console.log('[AUTH CALLBACK] Full URL:', requestUrl.toString())
  console.log('[AUTH CALLBACK] Code present:', !!code)
  console.log('[AUTH CALLBACK] Error present:', !!error)

  // If there's an error from Supabase, redirect to login with error message
  if (error) {
    console.error('[AUTH CALLBACK] Error from Supabase:', error, error_description)
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/login?error=${encodeURIComponent(error_description || error)}`
    )
  }

  // If we have a code, exchange it for a session
  if (code) {
    console.log('[AUTH CALLBACK] Attempting to exchange code for session...')
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('[AUTH CALLBACK] Exchange error:', exchangeError)
        return NextResponse.redirect(
          `${requestUrl.origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`
        )
      }

      console.log('[AUTH CALLBACK] Exchange successful! User:', data.user?.email)
      console.log('[AUTH CALLBACK] Email confirmed:', data.user?.email_confirmed_at)
      console.log('[AUTH CALLBACK] Redirecting to setup-restaurant')

      // Success! Redirect to setup restaurant page
      return NextResponse.redirect(`${requestUrl.origin}/auth/setup-restaurant`)
    } catch (err) {
      console.error('[AUTH CALLBACK] Unexpected error during code exchange:', err)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/login?error=An unexpected error occurred`
      )
    }
  }

  // No code or error, redirect to login
  console.log('[AUTH CALLBACK] No code or error parameter, redirecting to login')
  return NextResponse.redirect(`${requestUrl.origin}/auth/login`)
}
