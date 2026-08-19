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

export type PropertyInput = Omit<Partial<Tables["properties"]["Insert"]>, "id"> & {
  id?: string | undefined;
};

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

/* ---------- Roles, contexto, equipo e invitaciones ---------- */

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Invitation = Tables["invitations"]["Row"];

export const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario",
  manager: "Administrador",
  reception: "Recepción",
  cleaning: "Limpieza",
  maintenance: "Mantenimiento",
  accounting: "Contabilidad",
};

export const ROLE_SCOPE: Record<string, string> = {
  owner: "Acceso total, licencias y finanzas",
  manager: "Operación completa sin configuración de licencia",
  reception: "Llegadas, salidas y huéspedes de sus propiedades",
  cleaning: "Solo sus limpiezas asignadas (vista de trabajo)",
  maintenance: "Solo sus incidencias asignadas (vista de trabajo)",
  accounting: "Finanzas y reportes, sin datos operativos sensibles",
};

/** Roles que usan el panel de trabajador, nunca el panel administrativo. */
export const WORKER_ROLES: AppRole[] = ["cleaning", "maintenance", "reception"];
/** Roles que solo trabajan sobre propiedades asignadas. */
export const FIELD_ROLES: AppRole[] = ["cleaning", "maintenance"];
/** Roles invitables (owner nunca se invita). */
export const INVITABLE_ROLES: AppRole[] = [
  "manager",
  "reception",
  "cleaning",
  "maintenance",
  "accounting",
];

export type MyContext = {
  user_id: string;
  role: AppRole | null;
  org_id: string | null;
  org_name: string | null;
  license_status: string | null;
  access_status: string;
  is_platform_admin: boolean;
  property_ids: string[];
};

export async function fetchMyContext(): Promise<MyContext | null> {
  const { data, error } = await supabase.rpc("my_context");
  if (error) throw error;
  return (data as MyContext | null) ?? null;
}

export function useMyContext() {
  return useQuery({ queryKey: ["my-context"], queryFn: fetchMyContext, staleTime: 60_000 });
}

export async function fetchMyRole(): Promise<AppRole | null> {
  return (await fetchMyContext())?.role ?? null;
}

export function useMyRole() {
  const ctx = useMyContext();
  return { ...ctx, data: ctx.data?.role ?? null };
}

/** Ruta inicial según rol; evita mandar trabajadores al panel administrativo. */
export function homeForRole(role: AppRole | null | undefined) {
  if (!role) return "/pendiente";
  if (role === "cleaning" || role === "maintenance" || role === "reception") return "/trabajo";
  if (role === "accounting") return "/finanzas";
  return "/panel";
}

export type OrgMember = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: AppRole | null;
  access_status: string;
  created_at: string;
  property_ids: string[];
};

export function useOrgMembers(enabled = true) {
  return useQuery({
    queryKey: ["org-members"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("org_list_members");
      if (error) throw error;
      return (data ?? []) as OrgMember[];
    },
  });
}

export function useInvitations(enabled = true) {
  return useQuery({
    queryKey: ["invitations"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });
}

export const INVITE_ERROR: Record<string, string> = {
  not_authorized: "No tienes permiso para invitar personal.",
  owner_role_not_invitable: "El rol de propietario no se puede invitar.",
  license_inactive: "La licencia de la empresa no está activa.",
  max_users_reached: "Alcanzaste el límite de usuarios de tu licencia.",
  already_member: "Esa persona ya forma parte de tu equipo.",
  invalid_email: "El correo no es válido.",
  invalid_property: "Alguna propiedad seleccionada no pertenece a tu empresa.",
  invitation_not_found: "La invitación ya no existe.",
  already_accepted: "Esa invitación ya fue aceptada.",
};

export function inviteErrorMessage(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  const key = Object.keys(INVITE_ERROR).find((k) => raw.includes(k));
  return key ? INVITE_ERROR[key]! : raw;
}

export function useTeamMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["org-members"] });
    qc.invalidateQueries({ queryKey: ["invitations"] });
  };

  const setProperties = useMutation({
    mutationFn: async (input: { user_id: string; property_ids: string[] }) => {
      const { error } = await supabase.rpc("org_set_member_properties", {
        _user_id: input.user_id,
        _property_ids: input.property_ids,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const setStatus = useMutation({
    mutationFn: async (input: { user_id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase.rpc("org_set_member_status", {
        _user_id: input.user_id,
        _status: input.status,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("org_revoke_invitation", { _id: id });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { setProperties, setStatus, revoke, refresh };
}

/* ---------- Operación del trabajador ---------- */

export function useUpdateCleaningStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("cleaning_tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaning_tasks"] }),
  });
}

export function useUpdateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("maintenance_issues").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance_issues"] }),
  });
}

export type IssueInput = {
  property_id: string;
  title: string;
  description: string;
  priority: string;
  blocks_guests: boolean;
};

/** Reporte de incidencia desde el panel de trabajador; queda visible para la administración. */
export function useReportIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IssueInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const org_id = await currentOrgId();
      const { error } = await supabase.from("maintenance_issues").insert({
        org_id,
        property_id: input.property_id,
        title: input.title,
        description: input.description || null,
        priority: input.priority,
        status: "pendiente",
        blocks_guests: input.blocks_guests,
        reported_on: todayISO(),
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance_issues"] }),
  });
}

