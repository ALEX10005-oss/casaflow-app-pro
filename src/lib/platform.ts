import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];

export type PlatformStats = {
  organizations: number;
  licenses_active: number;
  licenses_suspended: number;
  users: number;
  properties: number;
};

export type PlatformUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  org_id: string | null;
  org_name: string | null;
  access_status: string;
  created_at: string;
};

/** Verificación real contra el backend. */
export async function checkPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin" as never);
  if (error) return false;
  return data === true;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform", "stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_stats" as never);
      if (error) throw error;
      return data as unknown as PlatformStats;
    },
  });
}

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: ["platform", "organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_organizations" as never);
      if (error) throw error;
      return (data ?? []) as unknown as Organization[];
    },
  });
}

export function usePlatformUsers() {
  return useQuery({
    queryKey: ["platform", "users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_users" as never);
      if (error) throw error;
      return (data ?? []) as unknown as PlatformUser[];
    },
  });
}

export type LicenseUpdate = {
  org_id: string;
  license_status?: string;
  license_type?: string;
  max_properties?: number;
  max_users?: number;
};

export function useUpdateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LicenseUpdate) => {
      const { error } = await supabase.rpc("platform_update_license" as never, {
        _org_id: input.org_id,
        _license_status: input.license_status ?? null,
        _license_type: input.license_type ?? null,
        _max_properties: input.max_properties ?? null,
        _max_users: input.max_users ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });
}

export const platformDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
