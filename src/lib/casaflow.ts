import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Property = Tables["properties"]["Row"];
export type Reservation = Tables["reservations"]["Row"];
export type Guest = Tables["guests"]["Row"];
export type CleaningTask = Tables["cleaning_tasks"]["Row"];
export type MaintenanceIssue = Tables["maintenance_issues"]["Row"];
export type Transaction = Tables["transactions"]["Row"];
export type Alert = Tables["alerts"]["Row"];
export type Integration = Tables["integrations"]["Row"];
export type TeamMember = Tables["team_members"]["Row"];
export type WhatsappMessage = Tables["whatsapp_messages"]["Row"];
export type WhatsappTemplate = Tables["whatsapp_templates"]["Row"];
export type WhatsappAutomation = Tables["whatsapp_automations"]["Row"];
export type PropertyBlock = Tables["property_blocks"]["Row"];
export type Organization = Tables["organizations"]["Row"];
export type Profile = Tables["profiles"]["Row"];

async function selectAll<T>(table: string, order?: string): Promise<T[]> {
  let q = supabase.from(table as never).select("*");
  if (order) q = q.order(order) as typeof q;
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

function table<T>(name: string, order?: string) {
  return () =>
    useQuery({ queryKey: [name], queryFn: () => selectAll<T>(name, order), staleTime: 30_000 });
}

export const useProperties = table<Property>("properties", "code");
export const useReservations = table<Reservation>("reservations", "check_in");
export const useGuests = table<Guest>("guests", "full_name");
export const useCleaningTasks = table<CleaningTask>("cleaning_tasks", "scheduled_date");
export const useMaintenance = table<MaintenanceIssue>("maintenance_issues", "reported_on");
export const useTransactions = table<Transaction>("transactions", "occurred_on");
export const useAlerts = table<Alert>("alerts", "created_at");
export const useIntegrations = table<Integration>("integrations", "provider");
export const useTeam = table<TeamMember>("team_members", "name");
export const useMessages = table<WhatsappMessage>("whatsapp_messages", "sent_at");
export const useTemplates = table<WhatsappTemplate>("whatsapp_templates", "name");
export const useAutomations = table<WhatsappAutomation>("whatsapp_automations", "name");
export const useBlocks = table<PropertyBlock>("property_blocks", "start_date");

export function useOrganization() {
  return useQuery({
    queryKey: ["organization"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").maybeSingle();
      if (error) throw error;
      return data as Organization | null;
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export type PropertyInput = Partial<Tables["properties"]["Insert"]> & { id?: string };

async function currentOrgId() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sesión no válida.");
  const { data, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.org_id) throw new Error("Tu usuario no tiene organización asignada.");
  return data.org_id;
}

export function useSaveProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PropertyInput) => {
      const { id, ...values } = input;
      if (id) {
        const { error } = await supabase.from("properties").update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const org_id = await currentOrgId();
      const { data, error } = await supabase
        .from("properties")
        .insert({ ...values, org_id } as Tables["properties"]["Insert"])
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  });
}

export const money = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(a: string, b: string) {
  return Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000,
  );
}

export const channelLabel: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "Vrbo",
  directo: "Directo",
  expedia: "Expedia",
};

export function statusTone(status: string) {
  const s = status.toLowerCase();
  if (["confirmada", "in_house", "hospedado", "active", "connected", "resuelta", "completada", "available", "activo", "active"].includes(s))
    return "success";
  if (["pendiente", "pending", "en_proceso", "programada", "media", "warning", "por_confirmar"].includes(s))
    return "warning";
  if (["cancelada", "urgente", "critical", "alta", "error", "bloqueada", "suspendido", "vencida"].includes(s))
    return "destructive";
  return "muted";
}
