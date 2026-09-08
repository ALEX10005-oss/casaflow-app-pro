import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useLicenseOverview, useUpdateLicense, type LicenseOverview } from "@/lib/platform";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  suspended: "Suspendida",
  pending: "Pendiente",
  revoked: "Revocada",
};
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function remaining(expiresAt: string | null) {
  if (!expiresAt) return { label: "Sin vencimiento", tone: "text-neutral-400" };
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Venció hace ${Math.abs(days)} días`, tone: "text-red-400" };
  if (days <= 15) return { label: `Vence en ${days} días`, tone: "text-amber-400" };
  return { label: `Vence en ${days} días`, tone: "text-emerald-400" };
}

function Usage({ used, limit, label }: { used: number; limit: number; label: string }) {
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return (
    <div className="min-w-32">
      <div className="flex justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span>
          {used}/{limit}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={cn("h-full rounded-full", percentage >= 90 ? "bg-red-500" : "bg-amber-500")}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function LicenseRow({ license }: { license: LicenseOverview }) {
  const update = useUpdateLicense();
  const [maxProperties, setMaxProperties] = useState(String(license.max_properties));
  const [maxUsers, setMaxUsers] = useState(String(license.max_users));
  const [type, setType] = useState(license.license_type);
  const [expiresAt, setExpiresAt] = useState(toDateInput(license.expires_at));
  const expiration = remaining(license.expires_at);

  async function save(nextStatus?: string) {
    const propertyLimit = Number(maxProperties);
    const userLimit = Number(maxUsers);
    if (!type.trim()) {
      toast.error("El plan es obligatorio");
      return;
    }
    if (!Number.isInteger(propertyLimit) || propertyLimit < license.properties_used) {
      toast.error(`El límite no puede ser menor a ${license.properties_used} propiedades en uso`);
      return;
    }
    if (!Number.isInteger(userLimit) || userLimit < license.users_used) {
      toast.error(`El límite no puede ser menor a ${license.users_used} usuarios en uso`);
      return;
    }
    try {
      await update.mutateAsync({
        org_id: license.id,
        license_type: type.trim(),
        max_properties: propertyLimit,
        max_users: userLimit,
        expires_at: expiresAt || null,
        ...(nextStatus ? { license_status: nextStatus } : {}),
      });
      toast.success(nextStatus ? "Estado de licencia actualizado" : "Licencia actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar");
    }
  }

  return (
    <tr className="border-b border-neutral-800/60 align-top last:border-0">
      <td className="px-4 py-4">
        <p className="font-medium text-white">{license.name}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {license.reservations_total} reservas registradas
        </p>
      </td>
      <td className="px-4 py-4">
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-28 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
        />
      </td>
      <td className="px-4 py-4">
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-semibold",
            license.license_status === "active"
              ? "bg-emerald-500/15 text-emerald-400"
              : license.license_status === "pending"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-red-500/15 text-red-400",
          )}
        >
          {STATUS_LABELS[license.license_status] ?? license.license_status}
        </span>
      </td>
      <td className="space-y-3 px-4 py-4">
        <Usage used={license.properties_used} limit={license.max_properties} label="Propiedades" />
        <Usage used={license.users_used} limit={license.max_users} label="Usuarios" />
      </td>
      <td className="px-4 py-4">
        <div className="flex gap-2">
          <input
            aria-label={`Límite de propiedades para ${license.name}`}
            value={maxProperties}
            onChange={(e) => setMaxProperties(e.target.value)}
            type="number"
            min={license.properties_used}
            className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
          />
          <input
            aria-label={`Límite de usuarios para ${license.name}`}
            value={maxUsers}
            onChange={(e) => setMaxUsers(e.target.value)}
            type="number"
            min={license.users_used}
            className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
          />
        </div>
      </td>
      <td className="px-4 py-4">
        <input
          aria-label={`Vencimiento de ${license.name}`}
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
        />
        <p className={cn("mt-1 text-xs", expiration.tone)}>{expiration.label}</p>
      </td>
      <td className="px-4 py-4">
        <div className="flex max-w-44 flex-wrap gap-2">
          <button
            disabled={update.isPending}
            onClick={() => save()}
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 disabled:opacity-50"
          >
            Guardar
          </button>
          {license.license_status !== "active" && (
            <button
              disabled={update.isPending}
              onClick={() => save("active")}
              className="rounded-md border border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-300 disabled:opacity-50"
            >
              Activar
            </button>
          )}
          {license.license_status === "active" && (
            <button
              disabled={update.isPending}
              onClick={() => save("suspended")}
              className="rounded-md border border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-300 disabled:opacity-50"
            >
              Suspender
            </button>
          )}
          {license.license_status !== "revoked" && (
            <button
              disabled={update.isPending}
              onClick={() => save("revoked")}
              className="rounded-md border border-red-900 px-3 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50"
            >
              Revocar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ControlLicencias() {
  const { data: licenses = [], isLoading, isError } = useLicenseOverview();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(
    () =>
      licenses.filter(
        (license) =>
          (status === "all" || license.license_status === status) &&
          license.name.toLowerCase().includes(search.toLowerCase().trim()),
      ),
    [licenses, search, status],
  );
  const expiring = licenses.filter(
    (license) =>
      license.expires_at &&
      new Date(license.expires_at).getTime() >= Date.now() &&
      new Date(license.expires_at).getTime() <= Date.now() + 30 * 86_400_000,
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Control de licencias</h1>
        <p className="text-sm text-neutral-400">
          Uso real, vigencia, límites y acceso por organización.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Activas</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {licenses.filter((l) => l.license_status === "active").length}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Bloqueadas</p>
          <p className="mt-1 text-2xl font-semibold text-red-400">
            {licenses.filter((l) => ["suspended", "revoked"].includes(l.license_status)).length}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Vencen en 30 días</p>
          <p className="mt-1 text-2xl font-semibold text-amber-400">{expiring}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa…"
          className="min-w-56 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="pending">Pendientes</option>
          <option value="suspended">Suspendidas</option>
          <option value="revoked">Revocadas</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Uso real</th>
              <th className="px-4 py-3">Límites</th>
              <th className="px-4 py-3">Vencimiento</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((license) => (
              <LicenseRow key={`${license.id}-${license.updated_at}`} license={license} />
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-neutral-500">
                  {isError
                    ? "No se pudieron cargar las licencias."
                    : "No hay licencias con esos filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/control/licencias")({ component: ControlLicencias });
