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
    const { restaurantId, ownerEmail } = body

    if (!restaurantId || !ownerEmail) {
      return NextResponse.json(
        { error: 'Restaurant ID and owner email are required' },
        { status: 400 }
      )
    }

    // Step 1: Verify the restaurant exists and belongs to the owner
    const { data: restaurant, error: fetchError } = await supabaseAdmin
      .from('restaurants')
      .select('owner_email')
      .eq('id', restaurantId)
      .single()

    if (fetchError || !restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    if (restaurant.owner_email !== ownerEmail) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this restaurant' },
        { status: 403 }
      )
    }

    // Step 2: Get all employees for this restaurant to delete their auth accounts
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('restaurant_id', restaurantId)

    if (employeesError) {
      console.error('Error fetching employees:', employeesError)
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      )
    }

    // Step 3: Delete all employee auth accounts
    if (employees && employees.length > 0) {
      for (const employee of employees) {
        if (employee.user_id) {
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(employee.user_id)
          if (authError) {
            console.error('Error deleting employee auth user:', authError)
            // Continue even if one fails - we'll clean up what we can
          }
        }
      }
    }

    // Step 4: Delete all related data (database CASCADE should handle most of this)
    // But we'll explicitly delete key tables to be safe

    // Delete employees (this will cascade to many other tables)
    await supabaseAdmin
      .from('employees')
      .delete()
      .eq('restaurant_id', restaurantId)

    // Delete shifts
    await supabaseAdmin
      .from('shifts')
      .delete()
      .eq('restaurant_id', restaurantId)

    // Delete business hours
    await supabaseAdmin
      .from('business_hours')
      .delete()
      .eq('restaurant_id', restaurantId)

    // Delete staffing requirements
    await supabaseAdmin
      .from('staffing_requirements')
      .delete()
      .eq('restaurant_id', restaurantId)

    // Delete blocked dates
    await supabaseAdmin
      .from('blocked_dates')
      .delete()
      .eq('restaurant_id', restaurantId)

    // Delete shift templates
    await supabaseAdmin
      .from('shift_templates')
      .delete()
      .eq('restaurant_id', restaurantId)

    // Delete time off requests
    await supabaseAdmin
      .from('time_off_requests')
      .delete()
      .eq('restaurant_id', restaurantId)

    // Delete shift swap requests
    await supabaseAdmin
      .from('shift_swap_requests')
      .delete()
      .eq('restaurant_id', restaurantId)

    // Step 5: Finally, delete the restaurant itself
    const { error: deleteError } = await supabaseAdmin
      .from('restaurants')
      .delete()
      .eq('id', restaurantId)

    if (deleteError) {
      console.error('Error deleting restaurant:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete restaurant: ${deleteError.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Restaurant and all associated data deleted successfully'
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
