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
    const { employeeId, userId } = body

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    // Step 1: Get the employee record to check if they own the restaurant
    const { data: employee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('email, restaurant_id')
      .eq('id', employeeId)
      .single()

    if (fetchError) {
      console.error('Error fetching employee:', fetchError)
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Step 2: Check if this employee owns the restaurant
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('owner_email')
      .eq('id', employee.restaurant_id)
      .single()

    if (restaurant && restaurant.owner_email === employee.email) {
      return NextResponse.json(
        { error: 'Cannot delete account: You are the business owner. Please transfer ownership or delete the business first.' },
        { status: 400 }
      )
    }

    // Step 3: Delete the auth user if it exists
    if (userId) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (authError) {
        console.error('Error deleting auth user:', authError)
        return NextResponse.json(
          { error: `Failed to delete user account: ${authError.message}` },
          { status: 400 }
        )
      }
    }

    // Step 4: Delete the employee record
    const { error: deleteError } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', employeeId)

    if (deleteError) {
      console.error('Error deleting employee:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Employee and auth user deleted successfully'
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
