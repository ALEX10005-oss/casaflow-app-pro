import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FIELD_ROLES, fetchMyRole } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const role = await fetchMyRole();
    const isField = !!role && FIELD_ROLES.includes(role);
    if (isField && location.pathname !== "/mis-tareas") {
      throw redirect({ to: "/mis-tareas" });
    }
    return { user: data.user, role };
  },
  component: () => <Outlet />,
});
