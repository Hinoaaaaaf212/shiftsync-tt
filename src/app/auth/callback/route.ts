import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // If there's an error from Supabase, redirect to login with error message
  if (error) {
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/login?error=${encodeURIComponent(error_description || error)}`
    )
  }

  // If we have a code, exchange it for a session
  if (code) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    try {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Error exchanging code for session:', exchangeError)
        return NextResponse.redirect(
          `${requestUrl.origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`
        )
      }

      // Success! Redirect to setup restaurant page
      return NextResponse.redirect(`${requestUrl.origin}/auth/setup-restaurant`)
    } catch (err) {
      console.error('Unexpected error during code exchange:', err)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/login?error=An unexpected error occurred`
      )
    }
  }

  // No code or error, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/auth/login`)
}
