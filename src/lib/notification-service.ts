/**
 * Notification Service
 *
 * Utility functions for managing in-app notifications in ShiftSync TT.
 * Handles creating, fetching, and updating notification states.
 */

import { supabase } from './supabase'
import { Notification, NotificationType, InsertNotification } from './database.types'

/**
 * Fetch all notifications for the current user
 * Sorted by most recent first
 */
export async function getUserNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching notifications:', error.message || error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Fetch unread notifications count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('Error fetching unread count:', error)
    return 0
  }

  return count || 0
}

/**
 * Fetch only unread notifications
 */
export async function getUnreadNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching unread notifications:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) {
    console.error('Error marking notification as read:', error)
    return { success: false, error }
  }

  return { success: true, error: null }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('Error marking all notifications as read:', error)
    return { success: false, error }
  }

  return { success: true, error: null }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) {
    console.error('Error deleting notification:', error)
    return { success: false, error }
  }

  return { success: true, error: null }
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting all notifications:', error)
    return { success: false, error }
  }

  return { success: true, error: null }
}

/**
 * Create a manual notification (for cases not handled by triggers)
 * Note: Most notifications are created automatically via database triggers
 */
export async function createNotification(notification: InsertNotification) {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select()
    .single()

  if (error) {
    console.error('Error creating notification:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Create a welcome notification for new employees
 */
export async function createWelcomeNotification(
  userId: string,
  restaurantId: string,
  employeeName: string,
  restaurantName: string
) {
  return createNotification({
    user_id: userId,
    restaurant_id: restaurantId,
    type: 'welcome',
    title: `Welcome to ${restaurantName}!`,
    message: `Hi ${employeeName}, welcome to the team! You can view your shifts and schedule from the dashboard.`,
    link: '/dashboard/my-shifts',
  })
}

/**
 * Subscribe to real-time notifications for a user
 * Returns an unsubscribe function
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
) {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as Notification)
      }
    )
    .subscribe()

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'shift_created':
      return '📅'
    case 'shift_updated':
      return '🔄'
    case 'shift_deleted':
      return '❌'
    case 'welcome':
      return '👋'
    case 'reminder':
      return '⏰'
    default:
      return '📢'
  }
}

/**
 * Get notification color class based on type
 */
export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'shift_created':
      return 'text-green-600'
    case 'shift_updated':
      return 'text-blue-600'
    case 'shift_deleted':
      return 'text-red-600'
    case 'welcome':
      return 'text-purple-600'
    case 'reminder':
      return 'text-orange-600'
    default:
      return 'text-gray-600'
  }
}

/**
 * Format notification time as relative time
 * e.g., "2 minutes ago", "1 hour ago", "2 days ago"
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`
  }

  return date.toLocaleDateString('en-TT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
