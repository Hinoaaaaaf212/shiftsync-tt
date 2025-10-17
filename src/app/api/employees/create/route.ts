import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
      position,
      hourlyRate,
      hireDate,
      restaurantId
    } = body

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role || !hireDate || !restaurantId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Step 1: Create Supabase auth user with service role
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Step 2: Create employee record
    const { error: insertError } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: authData.user.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone || null,
        role: role,
        position: position || null,
        hourly_rate: hourlyRate ? Number(hourlyRate) : null,
        hire_date: hireDate,
        status: 'active',
        restaurant_id: restaurantId
      })

    if (insertError) {
      // Rollback: Delete auth user if employee creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      )
    }

    // Step 3: Get restaurant name for welcome notification
    const { data: restaurantData } = await supabaseAdmin
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single()

    // Step 4: Create welcome notification for new employee
    if (role !== 'manager' && restaurantData) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: authData.user.id,
          restaurant_id: restaurantId,
          type: 'welcome',
          title: `Welcome to ${restaurantData.name}!`,
          message: `Hi ${firstName}, welcome to the team! You can view your shifts and schedule from the dashboard.`,
          link: '/dashboard/my-shifts',
          is_read: false
        })
    }

    return NextResponse.json(
      {
        success: true,
        userId: authData.user.id,
        email: email
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
