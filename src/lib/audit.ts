import { supabase } from "@/integrations/supabase/client";

export type AuditActionType =
  | "ARTICLE_CREATED"
  | "ARTICLE_UPDATED"
  | "ARTICLE_PUBLISHED"
  | "ARTICLE_DELETED"
  | "ARTICLE_BULK_UPDATE"
  | "USER_CREATED"
  | "USER_ROLE_CHANGED"
  | "USER_STATUS_CHANGED"
  | "LOGIN"
  | "LOGOUT"
  | "PASSWORD_RESET"
  | "INVITE_SENT"
  | "INVITE_ACCEPTED";

export type AuditTargetType = "article" | "user" | "setting" | "invitation";

interface LogAuditEventParams {
  actionType: AuditActionType;
  targetType?: AuditTargetType;
  targetId?: string;
  description: string;
  metadata?: Record<string, any>;
}

export async function logAuditEvent({
  actionType,
  targetType,
  targetId,
  description,
  metadata,
}: LogAuditEventParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("Cannot log audit event: No authenticated user");
      return;
    }

    const { error } = await supabase.from("audit_events").insert({
      user_id: user.id,
      user_email: user.email || "unknown",
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      description,
      metadata: metadata || null,
    });

    if (error) {
      console.error("Failed to log audit event:", error);
    }
  } catch (error) {
    console.error("Error logging audit event:", error);
  }
}
