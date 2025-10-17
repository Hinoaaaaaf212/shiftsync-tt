'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getRelativeTime,
  getNotificationIcon,
  getNotificationColor,
  getUnreadCount,
} from '@/lib/notification-service'
import { Notification } from '@/lib/database.types'

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

/**
 * NotificationPanel Component
 *
 * Dropdown panel that displays user notifications.
 * Features:
 * - List of notifications with read/unread status
 * - Click to navigate to linked page
 * - Mark individual notification as read
 * - Mark all as read
 * - Delete individual notification
 * - Empty state when no notifications
 */
export function NotificationPanel({
  isOpen,
  onClose,
  onUnreadCountChange,
}: NotificationPanelProps) {
  const { user } = useAuth()
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Fetch notifications when panel opens
  useEffect(() => {
    async function fetchNotifications() {
      if (!user?.id || !isOpen) return

      setIsLoading(true)
      setHasError(false)
      try {
        const { data, error } = await getUserNotifications(user.id)
        if (error) {
          setHasError(true)
        } else if (data) {
          setNotifications(data)
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchNotifications()
  }, [user?.id, isOpen])

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Update unread count
  const updateUnreadCount = async () => {
    if (!user?.id) return
    const count = await getUnreadCount(user.id)
    onUnreadCountChange?.(count)
  }

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      await markAsRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      )
      await updateUnreadCount()
    }

    // Navigate to link if exists
    if (notification.link) {
      router.push(notification.link)
      onClose()
    }
  }

  // Handle mark as read
  const handleMarkAsRead = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation()

    await markAsRead(notificationId)
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    )
    await updateUnreadCount()
  }

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    if (!user?.id) return

    await markAllAsRead(user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await updateUnreadCount()
  }

  // Handle delete notification
  const handleDeleteNotification = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation()

    await deleteNotification(notificationId)
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    await updateUnreadCount()
  }

  if (!isOpen) return null

  const unreadNotifications = notifications.filter((n) => !n.is_read)
  const hasUnread = unreadNotifications.length > 0

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-12 w-96 max-h-[600px] bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          {hasUnread && (
            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
              {unreadNotifications.length} new
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Actions */}
      {hasUnread && (
        <div className="p-2 border-b border-gray-200 bg-gray-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="w-full justify-start text-sm"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark all as read
          </Button>
        </div>
      )}

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
            <p>Loading notifications...</p>
          </div>
        ) : hasError ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-red-300" />
            <p className="font-medium text-gray-700 mb-2">Notification system not ready</p>
            <p className="text-sm text-gray-500 mb-3">
              The notifications table needs to be created in your database.
            </p>
            <p className="text-xs text-gray-400">
              Run the migration: <code className="bg-gray-100 px-2 py-1 rounded">database/create-notifications-table.sql</code>
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-700 mb-1">No notifications</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 transition-colors cursor-pointer ${
                  notification.is_read
                    ? 'bg-white hover:bg-gray-50'
                    : 'bg-blue-50 hover:bg-blue-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    <span
                      className={`text-2xl ${getNotificationColor(notification.type as any)}`}
                    >
                      {getNotificationIcon(notification.type as any)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-gray-900 text-sm">
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5"></div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {getRelativeTime(notification.created_at)}
                      </span>
                      <div className="flex items-center gap-1">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleMarkAsRead(e, notification.id)}
                            className="h-7 px-2 text-xs"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Mark read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) =>
                            handleDeleteNotification(e, notification.id)
                          }
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Showing {notifications.length} notification
            {notifications.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
