'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)

  // Load employee and restaurant data
  const loadEmployeeData = async (userId: string) => {
    try {
      // Get employee record
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (employeeError) {
        console.error('Error loading employee:', employeeError.message)
        return
      }

      // Set employee data (could be null for new users)
      setEmployee(employeeData)

      // Get restaurant data
      if (employeeData?.restaurant_id) {
        const { data: restaurantData, error: restaurantError } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', employeeData.restaurant_id)
          .single()

        if (restaurantError) {
          console.error('Error loading restaurant:', restaurantError.message)
          return
        }

        setRestaurant(restaurantData)
      } else if (!employeeData) {
        // New user with no employee record - check if they own a restaurant
        const { data: ownedRestaurant } = await supabase
          .from('restaurants')
          .select('*')
          .eq('owner_email', (await supabase.auth.getUser()).data.user?.email || '')
          .maybeSingle()

        if (ownedRestaurant) {
          setRestaurant(ownedRestaurant)
        }
      }
    } catch (error) {
      console.error('Error in loadEmployeeData:', error)
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
        return
      }

      // Debug: Log current state for comparison
      console.log('[AuthContext] DEBUG - Current user ID:', user?.id)
      console.log('[AuthContext] DEBUG - Incoming session user ID:', session?.user?.id)
      console.log('[AuthContext] DEBUG - Are they equal?', session?.user?.id === user?.id)

      // Check if this is the same user (e.g., tab focus re-detecting session)
      // If so, update session silently without showing loading screen
      if (session?.user?.id && session.user.id === user?.id) {
        console.log('[AuthContext] Same user detected, updating session silently')
        setSession(session)
        setUser(session.user)
        return
      }

      // For actual user changes (new login, different user), show loading state
      console.log('[AuthContext] Different user or new login, showing loading state')
      setLoading(true)
      setSession(session)
      setUser(session?.user ?? null)

      // Wait for employee data to load BEFORE setting loading to false
      if (session?.user) {
        await loadEmployeeData(session.user.id)
      } else {
        setEmployee(null)
        setRestaurant(null)
      }

      // Now that everything is loaded, set loading to false
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      })

      if (error) {
        return { error: error.message }
      }

      return {}
    } catch (error) {
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