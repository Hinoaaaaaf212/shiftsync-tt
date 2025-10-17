import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

// Create Supabase client with service role for API routes
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey)
}

// Helper function to format date for iCal (YYYYMMDD)
function formatICalDate(dateString: string, timeString: string): string {
  const [year, month, day] = dateString.split('-')
  const [hours, minutes] = timeString.split(':')
  return `${year}${month}${day}T${hours}${minutes}00`
}

// Helper function to format current timestamp
function formatICalTimestamp(): string {
  const now = new Date()
  return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

// Generate unique ID for iCal event
function generateEventId(shiftId: string, domain: string): string {
  return `shift-${shiftId}@${domain}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    // Initialize Supabase client
    const supabase = getSupabaseClient()

    const { employeeId } = await params

    // Validate employee ID
    if (!employeeId) {
      return new NextResponse('Employee ID is required', { status: 400 })
    }

    // Fetch employee information
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, restaurant_id')
      .eq('id', employeeId)
      .single()

    if (employeeError || !employee) {
      console.error('[Calendar API] Error fetching employee:', employeeError)
      return new NextResponse('Employee not found', { status: 404 })
    }

    // Fetch restaurant information
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', employee.restaurant_id)
      .single()

    // Fetch employee's shifts (last 30 days and next 90 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const ninetyDaysFromNow = new Date()
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)

    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('shift_date', thirtyDaysAgo.toISOString().split('T')[0])
      .lte('shift_date', ninetyDaysFromNow.toISOString().split('T')[0])
      .order('shift_date', { ascending: true })

    if (shiftsError) {
      console.error('[Calendar API] Error fetching shifts:', shiftsError)
      return new NextResponse('Failed to fetch shifts', { status: 500 })
    }

    console.log('[Calendar API] Generating calendar for employee:', {
      employeeId,
      name: `${employee.first_name} ${employee.last_name}`,
      shiftsCount: shifts?.length || 0
    })

    // Get domain from request URL
    const url = new URL(request.url)
    const domain = url.hostname

    // Generate iCal content
    const calendarName = `${employee.first_name} ${employee.last_name} - Shifts`
    const timestamp = formatICalTimestamp()

    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ShiftSync TT//Shift Schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarName}`,
      'X-WR-TIMEZONE:America/Port_of_Spain',
      `X-WR-CALDESC:Work shifts for ${employee.first_name} ${employee.last_name}`,
    ]

    // Add timezone definition
    icalContent.push(
      'BEGIN:VTIMEZONE',
      'TZID:America/Port_of_Spain',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0400',
      'TZNAME:AST',
      'END:STANDARD',
      'END:VTIMEZONE'
    )

    // Add each shift as an event
    if (shifts && shifts.length > 0) {
      for (const shift of shifts) {
        const dtstart = formatICalDate(shift.shift_date, shift.start_time)
        const dtend = formatICalDate(shift.shift_date, shift.end_time)
        const eventId = generateEventId(shift.id, domain)
        const summary = shift.position
          ? `Work Shift - ${shift.position.charAt(0).toUpperCase() + shift.position.slice(1)}`
          : 'Work Shift'
        const description = shift.notes || ''
        const location = restaurant?.name || ''

        icalContent.push(
          'BEGIN:VEVENT',
          `UID:${eventId}`,
          `DTSTAMP:${timestamp}`,
          `DTSTART;TZID=America/Port_of_Spain:${dtstart}`,
          `DTEND;TZID=America/Port_of_Spain:${dtend}`,
          `SUMMARY:${summary}`,
          ...(description ? [`DESCRIPTION:${description}`] : []),
          ...(location ? [`LOCATION:${location}`] : []),
          'STATUS:CONFIRMED',
          'SEQUENCE:0',
          'END:VEVENT'
        )
      }
    }

    icalContent.push('END:VCALENDAR')

    // Join with CRLF as per iCal specification
    const icalString = icalContent.join('\r\n')

    // Return iCal file
    return new NextResponse(icalString, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${employee.first_name}-${employee.last_name}-shifts.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error generating iCal:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
