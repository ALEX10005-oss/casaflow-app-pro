import { createFileRoute } from "@tanstack/react-router";
import { platformDate, usePlatformOrganizations } from "@/lib/platform";

function ControlEmpresas() {
  const { data: orgs, isLoading } = usePlatformOrganizations();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Empresas</h1>
        <p className="text-sm text-neutral-400">
          Organizaciones cliente registradas en la plataforma.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Límites</th>
              <th className="px-4 py-3">Alta</th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o) => (
              <tr key={o.id} className="border-b border-neutral-800/60 last:border-0">
                <td className="px-4 py-3 font-medium text-white">{o.name}</td>
                <td className="px-4 py-3 text-neutral-300">{o.license_type}</td>
                <td className="px-4 py-3 text-neutral-300">{o.license_status}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {o.max_properties} propiedades · {o.max_users} usuarios
                </td>
                <td className="px-4 py-3 text-neutral-400">{platformDate(o.created_at)}</td>
              </tr>
            ))}
            {!isLoading && (orgs ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  Sin organizaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/control/empresas")({
  component: ControlEmpresas,
});
