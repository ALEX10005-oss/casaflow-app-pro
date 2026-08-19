import { createFileRoute } from "@tanstack/react-router";
import { platformDate, usePlatformUsers } from "@/lib/platform";

function ControlUsuarios() {
  const { data: users, isLoading } = usePlatformUsers();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Usuarios</h1>
        <p className="text-sm text-neutral-400">Cuentas registradas por organización.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Alta</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-neutral-800/60 last:border-0">
                <td className="px-4 py-3 font-medium text-white">
                  {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-3 text-neutral-300">{u.email ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-300">{u.org_name ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-300">{u.access_status}</td>
                <td className="px-4 py-3 text-neutral-400">{platformDate(u.created_at)}</td>
              </tr>
            ))}
            {!isLoading && (users ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  Sin usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/control/usuarios")({
  component: ControlUsuarios,
});
