'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Employee, Restaurant } from '@/lib/database.types'

interface AuthContextType {
  user: User | null
  session: Session | null
  employee: Employee | null
  restaurant: Restaurant | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  updateProfile: (updates: Partial<Employee>) => Promise<{ error?: string }>
  refreshProfile: () => Promise<void>
  checkEmailExists: (email: string) => Promise<{ exists: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)

  // Track current user ID in a ref for immediate comparison (not dependent on state updates)
  const currentUserIdRef = useRef<string | null>(null)

  // Load employee and restaurant data
  const loadEmployeeData = async (userId: string) => {
    console.log('[AuthContext] loadEmployeeData START for userId:', userId)
    try {
      // Get employee record with timeout
      console.log('[AuthContext] Querying employees table...')

      // Create a timeout promise
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      )

      const query = supabase
        .from('employees')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      const result = await Promise.race([query, timeout]) as any

      console.log('[AuthContext] Employee query result:', { employeeData: result.data?.id, error: result.error })

      if (result.error && result.error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine for new users
        console.error('[AuthContext] Error loading employee:', result.error.message)
        console.error('[AuthContext] Error details:', result.error)
        // Don't return - continue with null employee
      }

      // Set employee data (could be null for new users)
      setEmployee(result.data || null)
      console.log('[AuthContext] Employee state set:', result.data ? 'has data' : 'null')

      const employeeData = result.data

      // Get restaurant data
      if (employeeData?.restaurant_id) {
        console.log('[AuthContext] Employee has restaurant_id, querying restaurant...')

        const restaurantTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Restaurant query timeout')), 5000)
        )

        const restaurantQuery = supabase
          .from('restaurants')
          .select('*')
          .eq('id', employeeData.restaurant_id)
          .single()

        try {
          const restaurantResult = await Promise.race([restaurantQuery, restaurantTimeout]) as any

          if (restaurantResult.error) {
            console.error('[AuthContext] Error loading restaurant:', restaurantResult.error.message)
          } else {
            setRestaurant(restaurantResult.data)
            console.log('[AuthContext] Restaurant state set')
          }
        } catch (err) {
          console.error('[AuthContext] Restaurant query timeout or error:', err)
        }
      } else if (!employeeData) {
        console.log('[AuthContext] No employee data, checking for owned restaurant...')
        // New user with no employee record - check if they own a restaurant
        const userEmail = (await supabase.auth.getUser()).data.user?.email || ''
        console.log('[AuthContext] Checking restaurants with owner_email:', userEmail)

        const ownedRestaurantTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Owned restaurant query timeout')), 5000)
        )

        const ownedRestaurantQuery = supabase
          .from('restaurants')
          .select('*')
          .eq('owner_email', userEmail)
          .maybeSingle()

        try {
          const ownedRestaurantResult = await Promise.race([ownedRestaurantQuery, ownedRestaurantTimeout]) as any

          console.log('[AuthContext] Owned restaurant query result:', { restaurant: ownedRestaurantResult.data?.id, error: ownedRestaurantResult.error })

          if (ownedRestaurantResult.data) {
            setRestaurant(ownedRestaurantResult.data)
            console.log('[AuthContext] Owned restaurant state set')
          } else {
            console.log('[AuthContext] No owned restaurant found')
          }
        } catch (err) {
          console.error('[AuthContext] Owned restaurant query timeout or error:', err)
        }
      }

      console.log('[AuthContext] loadEmployeeData COMPLETE')
    } catch (error) {
      console.error('[AuthContext] Exception in loadEmployeeData:', error)
      // Make sure we don't leave loading stuck even if there's an error
      console.log('[AuthContext] Continuing despite error...')
    }
  }

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      // If there's an error with the session (e.g., invalid refresh token), clear it
      if (error) {
        console.error('Session error:', error.message)
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setEmployee(null)
        setRestaurant(null)
        setLoading(false)
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      currentUserIdRef.current = session?.user?.id ?? null

      // Wait for employee data to load BEFORE setting loading to false
      if (session?.user) {
        await loadEmployeeData(session.user.id)
      }

      // Now that everything is loaded, set loading to false
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth state change:', event)

      // If signed out or token refresh failed, clear state
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null)
        setUser(null)
        currentUserIdRef.current = null
        setEmployee(null)
        setRestaurant(null)
        setLoading(false)
        return
      }

      // Skip INITIAL_SESSION event since we already handled it in getSession()
      if (event === 'INITIAL_SESSION') {
        return
      }

      // Skip TOKEN_REFRESHED event - no need to show loading state for background token refresh
      if (event === 'TOKEN_REFRESHED') {
        setSession(session)
        setUser(session?.user ?? null)
        currentUserIdRef.current = session?.user?.id ?? null
        return
      }

      // Debug: Log current state for comparison
      console.log('[AuthContext] DEBUG - Current user ID (ref):', currentUserIdRef.current)
      console.log('[AuthContext] DEBUG - Incoming session user ID:', session?.user?.id)
      console.log('[AuthContext] DEBUG - Are they equal?', session?.user?.id === currentUserIdRef.current)

      // Check if this is the same user (e.g., tab focus re-detecting session)
      // If so, update session silently without showing loading screen
      if (session?.user?.id && session.user.id === currentUserIdRef.current) {
        console.log('[AuthContext] Same user detected, updating session silently')
        setSession(session)
        setUser(session.user)
        // currentUserIdRef.current stays the same (already set)
        return
      }

      // For actual user changes (new login, different user), show loading state
      console.log('[AuthContext] Different user or new login, showing loading state')
      setLoading(true)
      setSession(session)
      setUser(session?.user ?? null)
      currentUserIdRef.current = session?.user?.id ?? null

      // Wait for employee data to load BEFORE setting loading to false
      if (session?.user) {
        console.log('[AuthContext] Calling loadEmployeeData...')
        await loadEmployeeData(session.user.id)
        console.log('[AuthContext] loadEmployeeData returned')
      } else {
        setEmployee(null)
        setRestaurant(null)
      }

      // Now that everything is loaded, set loading to false
      console.log('[AuthContext] Setting loading to false')
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkEmailExists = async (email: string) => {
    try {
      console.log('[AuthContext] Checking if email exists:', email)

      // Check if email exists in employees table (case-insensitive)
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id, email')
        .ilike('email', email)
        .maybeSingle()

      if (employeeError && employeeError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine
        console.error('[AuthContext] Error checking employees:', employeeError)
        return { exists: false, error: 'Failed to check email availability' }
      }

      if (employeeData) {
        console.log('[AuthContext] Email found in employees table:', employeeData.email)
        return { exists: true, error: 'This email is already registered as an employee. Please sign in instead.' }
      }

      // Check if email exists in restaurants table (as owner) - case-insensitive
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, owner_email')
        .ilike('owner_email', email)
        .maybeSingle()

      if (restaurantError && restaurantError.code !== 'PGRST116') {
        console.error('[AuthContext] Error checking restaurants:', restaurantError)
        return { exists: false, error: 'Failed to check email availability' }
      }

      if (restaurantData) {
        console.log('[AuthContext] Email found in restaurants table:', restaurantData.owner_email)
        return { exists: true, error: 'This email is already registered as a restaurant owner. Please sign in instead.' }
      }

      console.log('[AuthContext] Email is available')
      return { exists: false }
    } catch (error) {
      console.error('[AuthContext] Exception checking email:', error)
      return { exists: false, error: 'Failed to check email availability' }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error: error.message }
      }

      return {}
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: 'An unexpected error occurred' }
    }
  }

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      console.log('[AuthContext] Signing up user:', email)

      // Check if email already exists in database first
      const emailCheck = await checkEmailExists(email)
      if (emailCheck.exists) {
        console.error('[AuthContext] Email already exists')
        return { error: emailCheck.error || 'This email is already registered. Please sign in instead.' }
      }

      console.log('[AuthContext] Calling supabase.auth.signUp...')
      console.log('[AuthContext] emailRedirectTo:', `${window.location.origin}/auth/callback`)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          // CRITICAL: Tell Supabase where to redirect after email confirmation
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      console.log('[AuthContext] SignUp response:', {
        user: data.user?.id,
        email: data.user?.email,
        emailConfirmedAt: data.user?.email_confirmed_at,
        session: !!data.session,
        error: error
      })

      if (error) {
        console.error('[AuthContext] SignUp error:', error)
        return { error: error.message }
      }

      // CRITICAL: Log whether email confirmation is required
      if (data.user && !data.session) {
        console.log('[AuthContext] ✅ User created WITHOUT immediate session - email confirmation required')
        console.log('[AuthContext] Confirmation email should be sent to:', email)
        console.log('[AuthContext] User must click verification link to continue')
      } else if (data.session) {
        console.warn('[AuthContext] ⚠️ WARNING: User created WITH immediate session!')
        console.warn('[AuthContext] This means email confirmation is DISABLED in Supabase')
        console.warn('[AuthContext] Go to Supabase Dashboard → Authentication → Email Auth')
        console.warn('[AuthContext] Enable "Confirm email" to require email verification')
      }

      return {}
    } catch (error) {
      console.error('[AuthContext] SignUp exception:', error)
      return { error: 'An unexpected error occurred' }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setEmployee(null)
      setRestaurant(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        return { error: error.message }
      }

      return {}
    } catch (error) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const updateProfile = async (updates: Partial<Employee>) => {
    if (!employee) {
      return { error: 'No employee profile found' }
    }

    try {
      const { error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', employee.id)

      if (error) {
        return { error: error.message }
      }

      // Refresh the employee data
      await refreshProfile()
      return {}
    } catch (error) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await loadEmployeeData(user.id)
    }
  }

  const value = {
    user,
    session,
    employee,
    restaurant,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    refreshProfile,
    checkEmailExists,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}