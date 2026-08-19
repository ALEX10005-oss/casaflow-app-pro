import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { usePlatformOrganizations, useUpdateLicense } from "@/lib/platform";

function LicenseRow({
  id,
  name,
  licenseType,
  licenseStatus,
  maxProperties,
  maxUsers,
}: {
  id: string;
  name: string;
  licenseType: string;
  licenseStatus: string;
  maxProperties: number;
  maxUsers: number;
}) {
  const update = useUpdateLicense();
  const [props, setProps] = useState(String(maxProperties));
  const [users, setUsers] = useState(String(maxUsers));
  const [type, setType] = useState(licenseType);

  async function save(nextStatus?: string) {
    try {
      await update.mutateAsync({
        org_id: id,
        license_type: type,
        max_properties: Number(props) || maxProperties,
        max_users: Number(users) || maxUsers,
        ...(nextStatus ? { license_status: nextStatus } : {}),
      });
      toast.success("Licencia actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  return (
    <tr className="border-b border-neutral-800/60 last:border-0">
      <td className="px-4 py-3 font-medium text-white">{name}</td>
      <td className="px-4 py-3">
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-24 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <span
          className={
            licenseStatus === "active"
              ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400"
              : "rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400"
          }
        >
          {licenseStatus === "active" ? "Activa" : "Suspendida"}
        </span>
      </td>
      <td className="px-4 py-3">
        <input
          value={props}
          onChange={(e) => setProps(e.target.value)}
          inputMode="numeric"
          className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={users}
          onChange={(e) => setUsers(e.target.value)}
          inputMode="numeric"
          className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            disabled={update.isPending}
            onClick={() => save()}
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            disabled={update.isPending}
            onClick={() => save(licenseStatus === "active" ? "suspended" : "active")}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200 disabled:opacity-50"
          >
            {licenseStatus === "active" ? "Suspender" : "Activar"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function ControlLicencias() {
  const { data: orgs } = usePlatformOrganizations();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Licencias</h1>
        <p className="text-sm text-neutral-400">
          Estado, plan y límites por organización. Los cambios se validan en el backend.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Máx. props.</th>
              <th className="px-4 py-3">Máx. usuarios</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o) => (
              <LicenseRow
                key={o.id}
                id={o.id}
                name={o.name}
                licenseType={o.license_type}
                licenseStatus={o.license_status}
                maxProperties={o.max_properties}
                maxUsers={o.max_users}
              />
            ))}
            {(orgs ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  Sin licencias registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/control/licencias")({
  component: ControlLicencias,
});
