import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ClipboardList,
  Cog,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  MessageCircle,
  Plug,
  Receipt,
  Users,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { homeForRole, useAlerts, useMyRole, useOrganization, useProfile } from "@/lib/casaflow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROLE_ACCESS: Record<string, string[] | "all"> = {
  owner: "all",
  manager: ["/panel", "/calendario", "/reservas", "/propiedades", "/huespedes", "/operaciones", "/whatsapp", "/finanzas", "/reportes", "/integraciones", "/equipo", "/alertas"],
  accounting: ["/finanzas", "/reportes"],
  reception: [],
  cleaning: [],
  maintenance: [],
};


const GROUPS: { label: string; items: { to: string; label: string; icon: typeof Building2 }[] }[] = [
  {
    label: "Operación diaria",
    items: [
      { to: "/panel", label: "Panel del día", icon: LayoutDashboard },
      { to: "/calendario", label: "Calendario PMS", icon: CalendarDays },
      { to: "/reservas", label: "Reservas", icon: ClipboardList },
      { to: "/propiedades", label: "Propiedades", icon: Building2 },
      { to: "/huespedes", label: "Huéspedes", icon: Users },
    ],
  },
  {
    label: "Ejecución",
    items: [
      { to: "/operaciones", label: "Limpieza y mantenimiento", icon: Cog },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
    ],
  },
  {
    label: "Negocio",
    items: [
      { to: "/finanzas", label: "Finanzas", icon: Receipt },
      { to: "/reportes", label: "Reportes", icon: LineChart },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/integraciones", label: "Integraciones", icon: Plug },
      { to: "/equipo", label: "Equipo y roles", icon: UserCog },
      { to: "/alertas", label: "Alertas", icon: AlertTriangle },
      { to: "/configuracion", label: "Configuración", icon: Cog },
    ],
  },
];

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: org } = useOrganization();
  const { data: profile } = useProfile();
  const { data: alerts } = useAlerts();
  const { data: role } = useMyRole();
  const allowed = ROLE_ACCESS[role ?? "owner"] ?? "all";
  const groups = GROUPS.map((g) => ({
    ...g,
    items: allowed === "all" ? g.items : g.items.filter((i) => allowed.includes(i.to)),
  })).filter((g) => g.items.length > 0);
  const unread = (alerts ?? []).filter((a) => !a.is_read).length;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[17rem_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[17rem] flex-col justify-between overflow-y-auto bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:flex lg:h-screen lg:translate-x-0",
          open ? "flex translate-x-0" : "hidden -translate-x-full",
        )}
      >
        <div>
          <Link to={homeForRole(role)} className="mb-6 flex items-center gap-2 px-2">
            <span className="grid size-8 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
              CF
            </span>
            <span className="font-display text-lg font-semibold text-sidebar-accent-foreground">
              CasaFlow
            </span>
          </Link>
          <nav className="space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.to === "/alertas" && unread > 0 && (
                        <span className="rounded-full bg-sidebar-primary px-1.5 text-[10px] font-bold text-sidebar-primary-foreground">
                          {unread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-6 rounded-lg border border-sidebar-border p-3 text-xs">
          <p className="font-semibold text-sidebar-accent-foreground">
            {profile?.first_name ?? "Operador"} {profile?.last_name ?? ""}
          </p>
          <p className="text-sidebar-foreground/60">{org?.name ?? "Organización"}</p>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </header>
        <main className="px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
