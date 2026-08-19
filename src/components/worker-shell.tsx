import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CalendarDays, ClipboardList, Home, LogOut, User, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, useMyContext, type AppRole } from "@/lib/casaflow";

type NavItem = { to: string; label: string; icon: typeof Home };

const BASE: NavItem[] = [
  { to: "/trabajo", label: "Inicio", icon: Home },
  { to: "/trabajo/tareas", label: "Mis tareas", icon: ClipboardList },
  { to: "/trabajo/calendario", label: "Calendario", icon: CalendarDays },
];

const ISSUES: NavItem = { to: "/trabajo/incidencias", label: "Incidencias", icon: Wrench };
const PROFILE: NavItem = { to: "/trabajo/perfil", label: "Perfil", icon: User };

export function workerNav(role: AppRole | null | undefined): NavItem[] {
  const items = [...BASE];
  if (role === "cleaning" || role === "maintenance") items.push(ISSUES);
  items.push(PROFILE);
  return items;
}

/** Navegación mínima para personal de campo y recepción. Nunca el sidebar administrativo. */
export function WorkerShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: ctx } = useMyContext();
  const items = workerNav(ctx?.role);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl bg-background pb-24">
      <header className="sticky top-0 z-20 border-b bg-card/95 px-4 py-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {subtitle ?? `${ROLE_LABEL[ctx?.role ?? ""] ?? "Operación"} · ${ctx?.org_name ?? ""}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="space-y-3 px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-2xl justify-around border-t bg-card/95 px-2 py-2 backdrop-blur">
        {items.map((item) => {
          const active =
            item.to === "/trabajo" ? pathname === "/trabajo" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[11px]",
                active ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
