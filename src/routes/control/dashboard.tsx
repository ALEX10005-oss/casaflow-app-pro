import { createFileRoute } from "@tanstack/react-router";
import { platformDate, usePlatformOrganizations, usePlatformStats } from "@/lib/platform";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ControlDashboard() {
  const { data: stats } = usePlatformStats();
  const { data: orgs } = usePlatformOrganizations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Dashboard maestro</h1>
        <p className="text-sm text-neutral-400">Estado global de la plataforma CasaFlow.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Organizaciones" value={stats?.organizations ?? 0} />
        <Metric label="Licencias activas" value={stats?.licenses_active ?? 0} />
        <Metric label="Licencias suspendidas" value={stats?.licenses_suspended ?? 0} />
        <Metric label="Usuarios" value={stats?.users ?? 0} />
        <Metric label="Propiedades" value={stats?.properties ?? 0} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Licencia</th>
              <th className="px-4 py-3">Máx. propiedades</th>
              <th className="px-4 py-3">Máx. usuarios</th>
              <th className="px-4 py-3">Alta</th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o) => (
              <tr key={o.id} className="border-b border-neutral-800/60 last:border-0">
                <td className="px-4 py-3 font-medium text-white">{o.name}</td>
                <td className="px-4 py-3 text-neutral-300">{o.license_type}</td>
                <td className="px-4 py-3 text-neutral-300">{o.license_status}</td>
                <td className="px-4 py-3 text-neutral-300">{o.max_properties}</td>
                <td className="px-4 py-3 text-neutral-300">{o.max_users}</td>
                <td className="px-4 py-3 text-neutral-400">{platformDate(o.created_at)}</td>
              </tr>
            ))}
            {(orgs ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
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

export const Route = createFileRoute("/control/dashboard")({
  component: ControlDashboard,
});
