import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HealthSummary = {
  global_status: "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN";
  critical: number;
  warning: number;
  healthy: number;
  last_checked_at: string | null;
  open_incidents: number;
  unread_notifications: number;
};

export type HealthCheck = {
  id: string;
  check_key: string;
  check_name: string;
  status: string;
  severity: string;
  org_id: string | null;
  details: Record<string, unknown>;
  last_checked_at: string;
  first_failed_at: string | null;
  consecutive_failures: number;
};

export type Incident = {
  id: string;
  check_key: string;
  org_id: string | null;
  severity: string;
  title: string;
  description: string | null;
  recommended_action: string | null;
  status: string;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export type PlatformNotification = {
  id: string;
  incident_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export function useHealthSummary() {
  return useQuery({
    queryKey: ["platform", "health", "summary"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_health_summary" as never);
      if (error) throw error;
      return data as unknown as HealthSummary;
    },
  });
}

export function useHealthChecks() {
  return useQuery({
    queryKey: ["platform", "health", "checks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_health_checks" as never)
        .select("*")
        .order("status", { ascending: true })
        .order("check_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as HealthCheck[];
    },
  });
}

export function useIncidents() {
  return useQuery({
    queryKey: ["platform", "health", "incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_incidents" as never)
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Incident[];
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["platform", "health", "notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_notifications" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as PlatformNotification[];
    },
  });
}

function useInvalidateMonitor() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["platform", "health"] });
}

export function useRunHealthCheck() {
  const invalidate = useInvalidateMonitor();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_platform_health_check" as never);
      if (error) throw error;
      return data as unknown as HealthSummary;
    },
    onSuccess: invalidate,
  });
}

export function useAcknowledgeIncident() {
  const invalidate = useInvalidateMonitor();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("platform_acknowledge_incident" as never, {
        _incident_id: id,
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useMarkNotificationsRead() {
  const invalidate = useInvalidateMonitor();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("platform_mark_notifications_read" as never, {
        _ids: null,
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export const monitorDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
    : "Nunca";

/* ---------------- Alertas por WhatsApp (solo platform admin) ---------------- */

export type WhatsAppSettings = {
  id: string;
  platform_admin_user_id: string;
  whatsapp_enabled: boolean;
  whatsapp_recipient: string | null;
  notify_critical: boolean;
  notify_warning: boolean;
  warning_repeat_threshold: number;
};

export type WhatsAppDelivery = {
  id: string;
  incident_id: string | null;
  severity: string | null;
  recipient: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

export function useWhatsAppSettings() {
  return useQuery({
    queryKey: ["platform", "health", "wa-settings"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("platform_notification_settings" as never)
        .select("*")
        .eq("platform_admin_user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as WhatsAppSettings | null;
    },
  });
}

export function useSaveWhatsAppSettings() {
  const invalidate = useInvalidateMonitor();
  return useMutation({
    mutationFn: async (values: Partial<WhatsAppSettings>) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sesión no válida");
      const { error } = await supabase
        .from("platform_notification_settings" as never)
        .upsert(
          { platform_admin_user_id: uid, ...values } as never,
          { onConflict: "platform_admin_user_id" },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useWhatsAppDeliveries() {
  return useQuery({
    queryKey: ["platform", "health", "wa-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_notification_deliveries" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as unknown as WhatsAppDelivery[];
    },
  });
}
