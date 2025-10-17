# ShiftSync TT - AI Scheduler Implementation Guide

## Overview

The AI Scheduler is a **rule-based constraint satisfaction algorithm** that automatically generates optimized shift schedules for restaurants in Trinidad & Tobago. It respects employee preferences, availability blocks, labor laws, and business constraints while optimizing for fairness and cost.

---

## What Was Built

### 1. Database Schema (5 New Tables)

**File**: `database/add-ai-scheduling-tables.sql`

- **`business_hours`**: Operating hours for each day of the week (Mon-Sun)
- **`employee_availability`**: Times when employees are unavailable (recurring or specific dates)
- **`employee_preferences`**: Monthly hour targets, preferred shift times, max days/week
- **`staffing_requirements`**: Minimum and optimal staff needed per time slot
- **`ai_generated_schedules`**: Versioned schedule generations with stats and warnings

**Features**:
- Full RLS (Row-Level Security) policies
- Helper functions for availability checking and hour calculation
- Auto-initialization of default business hours for new restaurants
- Indexes for performance

### 2. TypeScript Type Definitions

**File**: `src/lib/database.types.ts`

Added complete type definitions for all 5 new tables with Row, Insert, Update, and Relationships interfaces.

### 3. Employee Preferences Page

**File**: `src/app/dashboard/preferences/page.tsx`

**URL**: `/dashboard/preferences`

**Features**:
- Set monthly hour targets (40-200 hours)
- Configure preferred shift start times and lengths
- Set maximum days per week to work
- Toggle weekend availability preference
- Add unavailability blocks:
  - **Recurring weekly**: "Every Monday" or "Every Friday afternoon"
  - **Specific dates**: "December 25, 2024" or "July 15, 2025"
  - **All-day or time-specific**: Block entire days or just specific hours
- Visual display of all unavailability blocks
- Delete blocks easily

**Access**: Any employee can manage their own preferences

### 4. Business Settings (Enhanced)

**File**: `src/app/dashboard/settings/page.tsx` (updated)

**URL**: `/dashboard/settings`

**New Sections**:

#### Business Hours Configuration
- Set open/close times for each day of the week
- Mark days as closed
- Used by AI to generate shifts within operating hours

#### Staffing Requirements
- Define min and optimal staff needed per time slot
- Configure by day of week and time range
- Example: "Monday 9am-5pm: Min 2, Optimal 4 staff"

**Access**: Managers only

### 5. AI Scheduler Algorithm

**File**: `src/lib/ai-scheduler.ts`

**Core Features**:

#### Hard Constraints (Must Satisfy)
- ✅ Employee unavailability blocks (recurring + specific dates)
- ✅ Approved time-off requests
- ✅ 8-hour rest period between shifts (Trinidad labor law)
- ✅ 40-hour standard workweek, 48-hour max (with overtime flag)
- ✅ Max days per week from employee preferences

#### Soft Constraints (Optimized via Scoring)
- **Fairness** (±30 points): Prioritizes employees below their monthly hour target
- **Preferences** (±20 points): Matches preferred shift times and lengths
- **Weekend Preference** (±20 points): Respects weekend availability preferences
- **Consecutive Days** (±15 points): Penalizes working too many days in a row
- **Cost Optimization** (±10 points): Prefers lower-cost employees when enabled

#### Scoring Algorithm
```
Base Score: 100

+ Fairness Bonus: +30 if <90% of target, +15 if <100%, -15 if >100%, -30 if >110%
+ Preference Bonus: +10 if within 30min of preferred start time
+ Preference Bonus: +10 if within 0.5hr of preferred shift length
+ Weekend Bonus: +10 if weekend and prefers weekends, -20 if weekend and doesn't prefer
- Consecutive Days Penalty: -15 if working 5+ days in a row
- Cost Penalty: -10 per $15 above minimum wage (if cost optimization enabled)
- Hard Penalty: -100 if at max days/week

Final Score = Sum of all modifiers
```

#### Generation Process
1. **Load Data**: Employees, preferences, availability, business hours, staffing requirements, existing shifts, time-off
2. **Iterate Through Week**: For each day (Mon-Sun)
3. **Check Business Hours**: Skip if restaurant is closed
4. **Apply Staffing Requirements**: Generate shifts for each time slot requirement
5. **Score All Employees**: Calculate score for each available employee
6. **Greedy Assignment**: Assign shift to highest-scoring employee
7. **Validate & Optimize**: Check fairness distribution, generate warnings
8. **Return Results**: Shifts + Stats + Warnings

### 6. Schedule Generator UI

**File**: `src/app/dashboard/schedule/generate/page.tsx`

**URL**: `/dashboard/schedule/generate`

**Features**:

#### Generation Settings
- Select week start date (must be a Monday)
- Toggle **Prioritize Fairness**: Distribute hours evenly
- Toggle **Prioritize Cost**: Minimize labor costs
- Toggle **Allow Overtime**: Allow 40-48 hour weeks

#### Results Display
- **Statistics Dashboard**:
  - Total shifts generated
  - Total hours across all shifts
  - Estimated labor cost (hours × hourly rates)
  - Fairness score (0-100, based on hour distribution)
- **Warnings Panel**: Shows any issues (understaffing, employees below target, etc.)
- **Shift Preview**: All generated shifts grouped by date with employee names and times

#### Publishing
- Review generated shifts before publishing
- One-click publish to live schedule
- Saves generation metadata for future reference

**Access**: Managers only

---

## How to Use the AI Scheduler

### Step 1: Initial Setup (First Time Only)

#### 1.1 Run Database Migration
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `database/add-ai-scheduling-tables.sql`
4. Copy and paste the entire script
5. Click **Run**
6. Verify success: `SELECT * FROM business_hours LIMIT 1;`

This will:
- Create all 5 new tables
- Set up RLS policies
- Create helper functions
- Auto-populate default business hours (Mon-Fri 9am-10pm, Sat-Sun 10am-11pm)

#### 1.2 Configure Business Hours
1. Go to `/dashboard/settings`
2. Scroll to **Business Hours** section
3. Adjust open/close times for each day
4. Mark closed days if applicable
5. Click **Save Business Hours**

#### 1.3 Configure Staffing Requirements (Optional but Recommended)
1. Still in `/dashboard/settings`
2. Scroll to **Staffing Requirements** section
3. Click **Add Staffing Requirement**
4. Example configurations:
   - **Monday Lunch**: 11:00-15:00, Min 2, Optimal 3
   - **Friday Dinner**: 17:00-22:00, Min 4, Optimal 6
   - **Saturday All Day**: 10:00-23:00, Min 3, Optimal 5
5. Repeat for all critical time periods

### Step 2: Employee Setup

#### 2.1 Set Employee Preferences
Each employee should:
1. Go to `/dashboard/preferences`
2. Set **Monthly Hour Target** (e.g., 160 hours = full-time, 120 hours = part-time)
3. Set **Preferred Shift Start Time** (e.g., 09:00 for morning shifts)
4. Set **Preferred Shift Length** (e.g., 8 hours)
5. Set **Maximum Days Per Week** (e.g., 6 days)
6. Toggle **Available for Weekend Shifts** (Yes/No)
7. Click **Save Preferences**

#### 2.2 Add Unavailability Blocks
Employees should add blocks for times they **cannot** work:

**Recurring Weekly Blocks**:
- Example: "Every Monday I have class from 9am-12pm"
  - Type: Recurring Weekly
  - Day: Monday
  - All Day: No
  - Start Time: 09:00
  - End Time: 12:00
  - Reason: "University class"

**Specific Date Blocks**:
- Example: "I'm traveling on December 25"
  - Type: Specific Date
  - Date: 2024-12-25
  - All Day: Yes
  - Reason: "Christmas holiday"

### Step 3: Generate a Schedule

#### 3.1 Navigate to Generator
1. Go to `/dashboard/schedule/generate`

#### 3.2 Configure Generation
1. **Select Week Start Date**:
   - Choose the Monday of the week you want to generate
   - Example: If today is Nov 14, select Nov 18 (next Monday)

2. **Set Priorities**:
   - **Prioritize Fairness**: ON (recommended)
     - Ensures all employees get similar hours relative to their targets
   - **Prioritize Cost**: OFF (unless budget-critical)
     - May give more hours to lower-paid employees
   - **Allow Overtime**: OFF (unless needed)
     - Allows 40-48 hour weeks instead of capping at 40

3. **Click "Generate Schedule"**

#### 3.3 Review Results
The AI will:
- ⏱️ Take 5-15 seconds to generate (depending on # of employees)
- 📊 Show statistics:
  - Total shifts created
  - Total hours scheduled
  - Estimated labor cost
  - Fairness score (higher is better)
- ⚠️ Display warnings:
  - "Could not find available staff for [date]"
  - "[Employee Name] has only X hours (below target)"
  - "Could not meet minimum staffing for [time slot]"
- 📅 Show all generated shifts grouped by date

#### 3.4 Publish Schedule
1. Review the generated shifts
2. Check warnings - adjust staffing requirements or employee availability if needed
3. If satisfied, click **Publish Schedule**
4. Shifts will be added to the live schedule
5. You'll be redirected to `/dashboard/schedule`

---

## Testing Scenarios

### Scenario 1: Basic Generation
**Setup**:
- 5 active employees
- All employees have preferences set (target: 160 hours/month)
- Business hours: Mon-Fri 9am-10pm
- No staffing requirements configured

**Expected Result**:
- ~35-50 shifts generated for the week
- Each employee gets 7-10 shifts
- Fair distribution (~30-40 hours each)
- Shifts spread across operating hours

### Scenario 2: Unavailability Constraints
**Setup**:
- Employee A: Unavailable all day Saturday (recurring)
- Employee B: Unavailable Dec 25 (specific date)
- Employee C: Unavailable Monday 9am-12pm (recurring)

**Generate Week Including Dec 25**

**Expected Result**:
- Employee A gets no Saturday shifts
- Employee B gets no shifts on Dec 25
- Employee C gets no Monday morning shifts
- Other employees fill the gaps

### Scenario 3: Fairness Distribution
**Setup**:
- Employee A: Already worked 120 hours this month (target: 160)
- Employee B: Already worked 80 hours this month (target: 160)
- Employee C: Already worked 40 hours this month (target: 160)
- All employees available equally

**Generate Week for End of Month**

**Expected Result**:
- Employee C gets most hours (furthest below target)
- Employee B gets moderate hours
- Employee A gets fewer hours (closest to target)
- Fairness score: 80-90+

### Scenario 4: Staffing Requirements
**Setup**:
- Friday 5pm-10pm: Min 4, Optimal 6 staff
- Saturday 12pm-8pm: Min 5, Optimal 7 staff
- Only 8 total employees

**Expected Result**:
- Friday evening: 6 employees scheduled
- Saturday afternoon: 7 employees scheduled
- Possible warning if employees have conflicting unavailability

### Scenario 5: Cost Optimization
**Setup**:
- Employee A: $15/hour
- Employee B: $20/hour
- Employee C: $25/hour
- Enable "Prioritize Cost"

**Expected Result**:
- Employee A gets more hours
- Employee C gets fewer hours (if fairness allows)
- Lower total estimated labor cost

### Scenario 6: Weekend Preferences
**Setup**:
- Employee A: Prefers weekends = Yes
- Employee B: Prefers weekends = No
- Employee C: No preference set

**Generate Schedule**

**Expected Result**:
- Employee A gets most weekend shifts
- Employee B gets fewer/no weekend shifts (unless needed for staffing)
- Employee C gets some weekend shifts

### Scenario 7: Maximum Days Per Week
**Setup**:
- Employee A: Max days per week = 3
- Employee B: Max days per week = 6
- High staffing requirements

**Expected Result**:
- Employee A works max 3 days
- Employee B works up to 6 days
- Warning if can't meet staffing with these constraints

---

## Trinidad Labor Law Compliance

The AI Scheduler automatically enforces:

✅ **40-hour standard workweek**
- Flags shifts that would exceed 40 hours
- Only allows if "Allow Overtime" is enabled
- Hard cap at 48 hours even with overtime

✅ **8-hour rest period between shifts**
- Checks previous day's shift end time
- Ensures 8+ hours before next shift starts
- Prevents employee burnout

✅ **Fair hour distribution**
- Prevents one employee from getting all hours
- Tracks monthly hour totals
- Warns if employees are below target

✅ **Voluntary overtime**
- Overtime must be explicitly enabled
- Never forces employees over 48 hours
- Respects max days/week preferences

---

## Troubleshooting

### Problem: "No active employees found"
**Solution**: Ensure employees are marked as `is_active = true` in database

### Problem: "Could not find available staff for [date]"
**Causes**:
- All employees have unavailability on that date
- All employees are at max days/week
- All employees exceed weekly hour limits

**Solutions**:
- Check employee availability blocks
- Increase max days/week for some employees
- Enable "Allow Overtime"
- Reduce staffing requirements

### Problem: Low fairness score (<50)
**Causes**:
- Employees have very different availability
- Conflicting max days/week settings
- Some employees have many unavailability blocks

**Solutions**:
- Review employee preferences and availability
- Adjust staffing requirements to spread demand
- Enable "Prioritize Fairness"

### Problem: "Could not meet minimum staffing"
**Causes**:
- Not enough employees total
- Too many employees unavailable at that time
- Employees at max hours/days

**Solutions**:
- Hire more employees
- Reduce min staffing requirement
- Adjust business hours to close during low-availability times
- Ask employees to adjust availability blocks

### Problem: High labor cost
**Solutions**:
- Enable "Prioritize Cost"
- Review employee hourly rates
- Reduce optimal staffing (keep min, lower optimal)
- Use more part-time employees with lower target hours

---

## Advanced Configuration

### Custom Shift Lengths
The AI respects employee preferences but can generate shifts of any length within business hours.

**Common Patterns**:
- **8-hour shifts**: Classic full shift (e.g., 9am-5pm, 2pm-10pm)
- **4-hour shifts**: Part-time or split coverage (e.g., lunch rush 11am-3pm)
- **12-hour shifts**: Weekend coverage (e.g., Sat 10am-10pm)

To configure: Set staffing requirements with appropriate time slots.

### Split Shifts
Currently not supported. Each employee gets one continuous shift per day.

Future enhancement: Allow `staffing_requirements.position_requirements` JSONB field to specify position-specific needs.

### Position-Based Scheduling
The algorithm currently considers employee positions but doesn't enforce position requirements.

**Future Enhancement**:
```json
{
  "position_requirements": {
    "server": 3,
    "cook": 2,
    "bartender": 1
  }
}
```

This would ensure the right mix of positions per shift.

---

## API Reference

### `generateSchedule()`

```typescript
async function generateSchedule(
  restaurantId: string,
  weekStartDate: Date,
  options?: {
    prioritizeFairness?: boolean  // Default: true
    prioritizeCost?: boolean      // Default: false
    allowOvertime?: boolean       // Default: false
  }
): Promise<{
  shifts: ScheduleShift[]
  warnings: string[]
  stats: {
    total_shifts: number
    total_hours: number
    estimated_labor_cost: number
    employees_scheduled: number
    fairness_score: number
  }
}>
```

**Example Usage**:
```typescript
import { generateSchedule } from '@/lib/ai-scheduler'

const result = await generateSchedule(
  'restaurant-uuid',
  new Date('2024-11-18'), // Monday
  {
    prioritizeFairness: true,
    prioritizeCost: false,
    allowOvertime: false
  }
)

console.log(`Generated ${result.shifts.length} shifts`)
console.log(`Fairness score: ${result.stats.fairness_score}`)
console.log(`Warnings: ${result.warnings.join(', ')}`)
```

---

## Future Enhancements

### Phase 3: AI Improvements
- [ ] Position-based requirements enforcement
- [ ] Multi-shift per employee per day
- [ ] Shift swap suggestions
- [ ] Predictive scheduling (ML-based demand forecasting)
- [ ] Employee skill levels and training requirements

### Phase 4: Integrations
- [ ] SMS notifications for new shifts
- [ ] WhatsApp integration (popular in Trinidad)
- [ ] Export to payroll systems
- [ ] Integration with POS systems for demand forecasting

### Phase 5: Advanced Features
- [ ] Shift marketplace (employees can claim open shifts)
- [ ] AI-powered shift swaps
- [ ] Vacation planning assistant
- [ ] Labor cost budgeting tools

---

## Navigation Setup

To add links to the new pages in your navigation:

### For Employees (Dashboard)
```tsx
<Button onClick={() => router.push('/dashboard/preferences')}>
  My Preferences
</Button>
```

### For Managers (Dashboard or Schedule Page)
```tsx
<Button onClick={() => router.push('/dashboard/schedule/generate')}>
  <Sparkles className="w-4 h-4 mr-2" />
  Generate Schedule
</Button>
```

---

## Summary

You now have a fully functional AI scheduling system with:

✅ **Database Schema**: 5 tables with RLS, indexes, and helper functions
✅ **Employee Preferences**: Monthly targets, shift preferences, unavailability blocks
✅ **Business Configuration**: Operating hours and staffing requirements
✅ **AI Algorithm**: Rule-based constraint satisfaction with weighted scoring
✅ **Generator UI**: One-click schedule generation with preview and publishing
✅ **Trinidad Compliance**: Labor law enforcement built-in
✅ **Fairness Optimization**: Balanced hour distribution across employees

**Next Steps**:
1. Run the database migration in Supabase
2. Configure business hours in Settings
3. Have employees set their preferences
4. Generate your first schedule!

**Support**:
- Check `AI_SCHEDULER_IMPLEMENTATION.md` for detailed documentation
- Review `src/lib/ai-scheduler.ts` for algorithm details
- Test with various scenarios to understand behavior

---

Built for ShiftSync TT 🇹🇹 - Smart Scheduling for Trinidad & Tobago Businesses
