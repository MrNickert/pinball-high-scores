import { supabase } from "@/integrations/supabase/client";

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  data,
}: CreateNotificationParams) => {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    data,
  });

  if (error) {
    console.error("Error creating notification:", error);
  }

  return { error };
};

// Notification types and their default messages
export const NotificationTypes = {
  WELCOME: "welcome",
  SCORE_PENDING: "score_pending",
  SCORE_VERIFIED: "score_verified",
  SCORE_REJECTED: "score_rejected",
  FRIEND_REQUEST: "friend_request",
  FRIEND_ACCEPTED: "friend_accepted",
} as const;
