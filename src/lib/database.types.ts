export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string
          name: string
          owner_email: string
          timezone: string
          address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_email: string
          timezone?: string
          address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_email?: string
          timezone?: string
          address?: string | null
          created_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string | null
          first_name: string
          last_name: string
          email: string
          phone: string | null
          role: string
          position: string | null
          hourly_rate: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          user_id?: string | null
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          role: string
          position?: string | null
          hourly_rate?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          user_id?: string | null
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          role?: string
          position?: string | null
          hourly_rate?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      shifts: {
        Row: {
          id: string
          restaurant_id: string
          employee_id: string
          shift_date: string
          start_time: string
          end_time: string
          position: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          employee_id: string
          shift_date: string
          start_time: string
          end_time: string
          position?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          employee_id?: string
          shift_date?: string
          start_time?: string
          end_time?: string
          position?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            referencedRelation: "employees"
            referencedColumns: ["id"]
          }
        ]
      }
      blocked_dates: {
        Row: {
          id: string
          restaurant_id: string
          date: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          date: string
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          date?: string
          reason?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          restaurant_id: string
          type: string
          title: string
          message: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          restaurant_id: string
          type: string
          title: string
          message: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          restaurant_id?: string
          type?: string
          title?: string
          message?: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      shift_templates: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          start_time: string
          end_time: string
          position: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          start_time: string
          end_time: string
          position?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          name?: string
          start_time?: string
          end_time?: string
          position?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      time_off_requests: {
        Row: {
          id: string
          restaurant_id: string
          employee_id: string
          start_date: string
          end_date: string
          reason: string
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          employee_id: string
          start_date: string
          end_date: string
          reason: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          employee_id?: string
          start_date?: string
          end_date?: string
          reason?: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_employee_id_fkey"
            columns: ["employee_id"]
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      shift_swap_requests: {
        Row: {
          id: string
          restaurant_id: string
          requester_id: string
          requester_shift_id: string
          requested_employee_id: string
          requested_shift_id: string
          status: string
          requester_notes: string | null
          denial_reason: string | null
          employee_response_at: string | null
          manager_reviewed_by: string | null
          manager_reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          requester_id: string
          requester_shift_id: string
          requested_employee_id: string
          requested_shift_id: string
          status?: string
          requester_notes?: string | null
          denial_reason?: string | null
          employee_response_at?: string | null
          manager_reviewed_by?: string | null
          manager_reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          requester_id?: string
          requester_shift_id?: string
          requested_employee_id?: string
          requested_shift_id?: string
          status?: string
          requester_notes?: string | null
          denial_reason?: string | null
          employee_response_at?: string | null
          manager_reviewed_by?: string | null
          manager_reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_id_fkey"
            columns: ["requester_id"]
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_shift_id_fkey"
            columns: ["requester_shift_id"]
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requested_employee_id_fkey"
            columns: ["requested_employee_id"]
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requested_shift_id_fkey"
            columns: ["requested_shift_id"]
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_manager_reviewed_by_fkey"
            columns: ["manager_reviewed_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      business_hours: {
        Row: {
          id: string
          restaurant_id: string
          day_of_week: number
          open_time: string
          close_time: string
          is_closed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          day_of_week: number
          open_time: string
          close_time: string
          is_closed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          day_of_week?: number
          open_time?: string
          close_time?: string
          is_closed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      employee_availability: {
        Row: {
          id: string
          employee_id: string
          restaurant_id: string
          day_of_week: number | null
          specific_date: string | null
          unavailable_start_time: string | null
          unavailable_end_time: string | null
          is_all_day: boolean
          reason: string | null
          is_recurring: boolean
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          restaurant_id: string
          day_of_week?: number | null
          specific_date?: string | null
          unavailable_start_time?: string | null
          unavailable_end_time?: string | null
          is_all_day?: boolean
          reason?: string | null
          is_recurring?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          restaurant_id?: string
          day_of_week?: number | null
          specific_date?: string | null
          unavailable_start_time?: string | null
          unavailable_end_time?: string | null
          is_all_day?: boolean
          reason?: string | null
          is_recurring?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_availability_employee_id_fkey"
            columns: ["employee_id"]
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_availability_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      employee_preferences: {
        Row: {
          employee_id: string
          target_monthly_hours: number
          preferred_shift_start_time: string | null
          preferred_shift_length_hours: number | null
          max_days_per_week: number
          prefers_weekends: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          employee_id: string
          target_monthly_hours?: number
          preferred_shift_start_time?: string | null
          preferred_shift_length_hours?: number | null
          max_days_per_week?: number
          prefers_weekends?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          employee_id?: string
          target_monthly_hours?: number
          preferred_shift_start_time?: string | null
          preferred_shift_length_hours?: number | null
          max_days_per_week?: number
          prefers_weekends?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_preferences_employee_id_fkey"
            columns: ["employee_id"]
            referencedRelation: "employees"
            referencedColumns: ["id"]
          }
        ]
      }
      staffing_requirements: {
        Row: {
          id: string
          restaurant_id: string
          day_of_week: number
          time_slot_start: string
          time_slot_end: string
          min_staff_required: number
          optimal_staff: number
          position_requirements: Record<string, number> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          day_of_week: number
          time_slot_start: string
          time_slot_end: string
          min_staff_required?: number
          optimal_staff?: number
          position_requirements?: Record<string, number> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          day_of_week?: number
          time_slot_start?: string
          time_slot_end?: string
          min_staff_required?: number
          optimal_staff?: number
          position_requirements?: Record<string, number> | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_requirements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_generated_schedules: {
        Row: {
          id: string
          restaurant_id: string
          week_start_date: string
          generation_params: Record<string, any> | null
          total_shifts: number
          total_hours: number | null
          estimated_labor_cost: number | null
          warnings: Array<string> | null
          status: string
          generated_by: string | null
          created_at: string
          published_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          week_start_date: string
          generation_params?: Record<string, any> | null
          total_shifts?: number
          total_hours?: number | null
          estimated_labor_cost?: number | null
          warnings?: Array<string> | null
          status?: string
          generated_by?: string | null
          created_at?: string
          published_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          week_start_date?: string
          generation_params?: Record<string, any> | null
          total_shifts?: number
          total_hours?: number | null
          estimated_labor_cost?: number | null
          warnings?: Array<string> | null
          status?: string
          generated_by?: string | null
          created_at?: string
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_schedules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_schedules_generated_by_fkey"
            columns: ["generated_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Derived types for easier use
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type Employee = Database['public']['Tables']['employees']['Row']
export type Shift = Database['public']['Tables']['shifts']['Row']
export type BlockedDate = Database['public']['Tables']['blocked_dates']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type ShiftTemplate = Database['public']['Tables']['shift_templates']['Row']
export type TimeOffRequest = Database['public']['Tables']['time_off_requests']['Row']
export type ShiftSwapRequest = Database['public']['Tables']['shift_swap_requests']['Row']

export type InsertRestaurant = Database['public']['Tables']['restaurants']['Insert']
export type InsertEmployee = Database['public']['Tables']['employees']['Insert']
export type InsertShift = Database['public']['Tables']['shifts']['Insert']
export type InsertBlockedDate = Database['public']['Tables']['blocked_dates']['Insert']
export type InsertNotification = Database['public']['Tables']['notifications']['Insert']
export type InsertShiftTemplate = Database['public']['Tables']['shift_templates']['Insert']
export type InsertTimeOffRequest = Database['public']['Tables']['time_off_requests']['Insert']
export type InsertShiftSwapRequest = Database['public']['Tables']['shift_swap_requests']['Insert']

export type UpdateRestaurant = Database['public']['Tables']['restaurants']['Update']
export type UpdateEmployee = Database['public']['Tables']['employees']['Update']
export type UpdateShift = Database['public']['Tables']['shifts']['Update']
export type UpdateBlockedDate = Database['public']['Tables']['blocked_dates']['Update']
export type UpdateNotification = Database['public']['Tables']['notifications']['Update']
export type UpdateShiftTemplate = Database['public']['Tables']['shift_templates']['Update']
export type UpdateTimeOffRequest = Database['public']['Tables']['time_off_requests']['Update']
export type UpdateShiftSwapRequest = Database['public']['Tables']['shift_swap_requests']['Update']

// Employee roles and positions
export type EmployeeRole = 'manager' | 'employee'
export type EmployeePosition = 'server' | 'cook' | 'bartender' | 'host' | 'dishwasher'

// Notification types
export type NotificationType = 'shift_created' | 'shift_updated' | 'shift_deleted' | 'welcome' | 'reminder' | 'time_off_requested' | 'time_off_approved' | 'time_off_denied'

// Time off request status
export type TimeOffStatus = 'pending' | 'approved' | 'denied'

// Shift swap request status
export type ShiftSwapStatus = 'pending_employee' | 'pending_manager' | 'approved' | 'denied' | 'cancelled'

// Extended employee type with computed properties
export type EmployeeWithSchedule = Employee & {
  full_name: string
  shifts?: Shift[]
}

// Shift with employee information
export type ShiftWithEmployee = Shift & {
  employee: Employee
}

// Time off request with employee information
export type TimeOffRequestWithEmployee = TimeOffRequest & {
  employee: Employee
}

// Shift swap request with employee and shift information
export type ShiftSwapRequestWithDetails = ShiftSwapRequest & {
  requester: Employee
  requester_shift: Shift
  requested_employee: Employee
  requested_shift: Shift
}

// Restaurant with employees and shifts
export type RestaurantWithData = Restaurant & {
  employees?: Employee[]
  shifts?: Shift[]
  blocked_dates?: BlockedDate[]
  notifications?: Notification[]
  shift_templates?: ShiftTemplate[]
  time_off_requests?: TimeOffRequest[]
}