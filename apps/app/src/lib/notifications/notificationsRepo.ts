import { supabase } from "@/lib/supabase";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type AppNotification,
  type NotificationCategory,
  type NotificationPreferences,
} from "./types";

interface NotificationRow {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

const fromRow = (row: NotificationRow): AppNotification => ({
  id: row.id,
  userId: row.user_id,
  category: row.category,
  title: row.title,
  body: row.body,
  actionUrl: row.action_url,
  metadata: row.metadata ?? {},
  readAt: row.read_at,
  createdAt: row.created_at,
});

export async function listNotifications(userId: string, limit = 100): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,user_id,category,title,body,action_url,metadata,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(fromRow);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string, read = true): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

export async function clearReadNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .not("read_at", "is", null);
  if (error) throw error;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("shares_enabled,exams_enabled,support_enabled,product_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    sharesEnabled: data.shares_enabled,
    examsEnabled: data.exams_enabled,
    supportEnabled: data.support_enabled,
    productEnabled: data.product_enabled,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<void> {
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    shares_enabled: preferences.sharesEnabled,
    exams_enabled: preferences.examsEnabled,
    support_enabled: preferences.supportEnabled,
    product_enabled: preferences.productEnabled,
  });
  if (error) throw error;
}

export function subscribeToNotifications(userId: string, onChange: () => void) {
  const subscriptionId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const channel = supabase
    .channel(`notifications:${userId}:${subscriptionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
