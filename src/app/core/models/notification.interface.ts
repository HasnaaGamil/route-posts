export type NotificationKind = 'like' | 'comment' | 'reply' | 'share' | 'follow' | 'other';

/** A notification in the shape the UI uses (the service maps the API response into this) */
export interface AppNotification {
  id: string;
  actor: { _id: string; name: string; username: string; photo?: string };
  kind: NotificationKind;
  /** The action, e.g. "liked your post" */
  text: string;
  /** Snippet of the post or comment it is about */
  preview: string;
  /** Post to open when the notification is clicked (none for follows) */
  postId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  nextPage: number | null;
  total: number | null;
}