export type NotificationCategory = "share" | "exam" | "support" | "product" | "system";

export interface AppNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  sharesEnabled: boolean;
  examsEnabled: boolean;
  supportEnabled: boolean;
  productEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  sharesEnabled: true,
  examsEnabled: true,
  supportEnabled: true,
  productEnabled: true,
};
