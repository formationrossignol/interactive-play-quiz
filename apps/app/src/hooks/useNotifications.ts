import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearReadNotifications,
  countUnreadNotifications,
  deleteNotification,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  updateNotificationPreferences,
} from "@/lib/notifications/notificationsRepo";
import type { NotificationPreferences } from "@/lib/notifications/types";

const listKey = (userId: string) => ["notifications", userId] as const;
const unreadKey = (userId: string) => ["notification-unread-count", userId] as const;
const preferencesKey = (userId: string) => ["notification-preferences", userId] as const;

export function useNotifications(userId?: string, limit = 100) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: userId ? listKey(userId) : ["notifications", "anonymous"],
    queryFn: () => listNotifications(userId!, limit),
    enabled: Boolean(userId),
  });
  const preferences = useQuery({
    queryKey: userId ? preferencesKey(userId) : ["notification-preferences", "anonymous"],
    queryFn: () => getNotificationPreferences(userId!),
    enabled: Boolean(userId),
  });
  const unread = useQuery({
    queryKey: userId ? unreadKey(userId) : ["notification-unread-count", "anonymous"],
    queryFn: () => countUnreadNotifications(userId!),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) return;
    return subscribeToNotifications(userId, () => {
      void queryClient.invalidateQueries({ queryKey: listKey(userId) });
      void queryClient.invalidateQueries({ queryKey: unreadKey(userId) });
    });
  }, [queryClient, userId]);

  const invalidateList = () => {
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: listKey(userId) });
      void queryClient.invalidateQueries({ queryKey: unreadKey(userId) });
    }
  };

  const markRead = useMutation({
    mutationFn: ({ id, read = true }: { id: string; read?: boolean }) => markNotificationRead(id, read),
    onSuccess: invalidateList,
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: invalidateList,
  });
  const remove = useMutation({
    mutationFn: deleteNotification,
    onSuccess: invalidateList,
  });
  const clearRead = useMutation({
    mutationFn: () => clearReadNotifications(userId!),
    onSuccess: invalidateList,
  });
  const savePreferences = useMutation({
    mutationFn: (value: NotificationPreferences) => updateNotificationPreferences(userId!, value),
    onSuccess: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: preferencesKey(userId) });
    },
  });

  const notifications = list.data ?? [];
  return {
    notifications,
    unreadCount: unread.data ?? notifications.filter((notification) => !notification.readAt).length,
    isLoading: list.isLoading,
    preferences: preferences.data,
    preferencesLoading: preferences.isLoading,
    markRead,
    markAllRead,
    remove,
    clearRead,
    savePreferences,
  };
}
