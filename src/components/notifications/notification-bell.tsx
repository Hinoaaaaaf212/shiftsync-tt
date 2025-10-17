'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { getUnreadCount, subscribeToNotifications } from '@/lib/notification-service'
import { NotificationPanel } from './notification-panel'

/**
 * NotificationBell Component
 *
 * Displays a bell icon with an unread notification badge count.
 * Opens a dropdown panel when clicked showing recent notifications.
 * Supports real-time updates via Supabase realtime subscriptions.
 */
export function NotificationBell() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch initial unread count
  useEffect(() => {
    async function fetchUnreadCount() {
      if (!user?.id) return

      setIsLoading(true)
      try {
        const count = await getUnreadCount(user.id)
        setUnreadCount(count)
      } catch (error) {
        console.error('Error fetching unread count:', error)
        // Fail silently - notification system may not be set up yet
        setUnreadCount(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUnreadCount()
  }, [user?.id])

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id) return

    const unsubscribe = subscribeToNotifications(user.id, (notification) => {
      // Increment unread count when new notification arrives
      if (!notification.is_read) {
        setUnreadCount((prev) => prev + 1)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [user?.id])

  // Handle notification count updates from NotificationPanel
  const handleUnreadCountChange = (newCount: number) => {
    setUnreadCount(newCount)
  }

  if (!user) return null

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {!isLoading && unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center bg-red-600 text-white text-xs px-1"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <NotificationPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onUnreadCountChange={handleUnreadCountChange}
        />
      )}
    </div>
  )
}
