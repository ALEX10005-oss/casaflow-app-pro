import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkPlatformAdmin } from "@/lib/platform";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/control/dashboard", label: "Dashboard" },
  { to: "/control/empresas", label: "Empresas" },
  { to: "/control/licencias", label: "Licencias" },
  { to: "/control/usuarios", label: "Usuarios" },
  { to: "/control/sistema", label: "Sistema" },
];

function NotAvailable() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="text-center">
        <p className="font-display text-5xl font-bold text-muted-foreground">404</p>
        <h1 className="mt-3 font-display text-xl font-semibold">Página no disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La dirección que buscas no existe o fue movida.
        </p>
        <Link to="/" className="mt-5 inline-block text-sm font-semibold text-primary underline">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function ControlLayout() {
  const { isAdmin } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!isAdmin) return <NotAvailable />;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3">
          <span className="font-display text-sm font-bold tracking-widest text-amber-400">
            CONTROL
          </span>
          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname.startsWith(item.to)
                    ? "bg-neutral-800 font-semibold text-white"
                    : "text-neutral-400 hover:text-neutral-100",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button onClick={signOut} className="text-xs text-neutral-400 hover:text-neutral-100">
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createFileRoute("/control")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const isAdmin = await checkPlatformAdmin();
    return { isAdmin };
  },
  component: ControlLayout,
});
