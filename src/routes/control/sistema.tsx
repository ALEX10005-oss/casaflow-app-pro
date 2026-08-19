import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePlatformOrganizations, usePlatformStats } from "@/lib/platform";
import {
  monitorDateTime,
  useAcknowledgeIncident,
  useHealthChecks,
  useHealthSummary,
  useIncidents,
  useRunHealthCheck,
} from "@/lib/monitor";

const GLOBAL_STYLES: Record<string, { label: string; box: string; dot: string }> = {
  HEALTHY: {
    label: "Todo operativo",
    box: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  WARNING: {
    label: "Atención requerida",
    box: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  CRITICAL: {
    label: "Fallo crítico",
    box: "border-red-500/30 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
  },
  UNKNOWN: {
    label: "Sin datos de diagnóstico",
    box: "border-neutral-700 bg-neutral-900 text-neutral-300",
    dot: "bg-neutral-500",
  },
};

const STATUS_TEXT: Record<string, string> = {
  healthy: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-semibold text-white", tone)}>{value}</p>
    </div>
  );
}

function ControlSistema() {
  const { data: summary } = useHealthSummary();
  const { data: checks = [] } = useHealthChecks();
  const { data: incidents = [] } = useIncidents();
  const { data: stats, isError } = usePlatformStats();
  const { data: orgs = [] } = usePlatformOrganizations();
  const run = useRunHealthCheck();
  const ack = useAcknowledgeIncident();

  const orgName = (id: string | null) =>
    id ? (orgs.find((o) => o.id === id)?.name ?? "Empresa desconocida") : "Global";

  const open = incidents.filter((i) => i.status !== "resolved");
  const history = incidents.filter((i) => i.status === "resolved");
  const g = GLOBAL_STYLES[summary?.global_status ?? "UNKNOWN"] ?? GLOBAL_STYLES["UNKNOWN"]!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Sistema y monitoreo</h1>
          <p className="text-sm text-neutral-400">
            Diagnóstico preventivo de la plataforma. Automático cada 15 minutos.
          </p>
        </div>
        <button
          onClick={() =>
            run.mutate(undefined, {
              onSuccess: () => toast.success("Diagnóstico ejecutado"),
              onError: (e: Error) => toast.error(e.message),
            })
          }
          disabled={run.isPending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {run.isPending ? "Ejecutando…" : "Ejecutar diagnóstico ahora"}
        </button>
      </div>

      <div className={cn("flex flex-wrap items-center gap-4 rounded-lg border px-5 py-5", g.box)}>
        <span className={cn("h-4 w-4 rounded-full", g.dot)} />
        <div>
          <p className="font-display text-2xl font-semibold">{g.label}</p>
          <p className="text-xs opacity-80">
            Última revisión: {monitorDateTime(summary?.last_checked_at ?? null)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Checks saludables" value={summary?.healthy ?? 0} tone="text-emerald-400" />
        <Metric label="Advertencias" value={summary?.warning ?? 0} tone="text-amber-400" />
        <Metric label="Críticos" value={summary?.critical ?? 0} tone="text-red-400" />
        <Metric label="Incidentes abiertos" value={summary?.open_incidents ?? 0} />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">Incidentes abiertos</h2>
        {open.length === 0 && (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
            Sin incidentes abiertos.
          </p>
        )}
        {open.map((i) => (
          <div
            key={i.id}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-white">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                      i.severity === "critical"
                        ? "border-red-500/40 text-red-300"
                        : "border-amber-500/40 text-amber-300",
                    )}
                  >
                    {i.severity === "critical" ? "Crítico" : "Advertencia"}
                  </span>
                  {i.title}
                </p>
                <p className="mt-1 text-neutral-400">{i.description}</p>
                {i.recommended_action && (
                  <p className="mt-1 text-neutral-500">
                    <span className="text-neutral-400">Acción recomendada:</span>{" "}
                    {i.recommended_action}
                  </p>
                )}
                <p className="mt-1 text-xs text-neutral-600">
                  {orgName(i.org_id)} · detectado {monitorDateTime(i.detected_at)} · {i.check_key}
                </p>
              </div>
              {i.status === "open" ? (
                <button
                  onClick={() =>
                    ack.mutate(i.id, {
                      onSuccess: () => toast.success("Incidente marcado como revisado"),
                      onError: (e: Error) => toast.error(e.message),
                    })
                  }
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  Marcar como revisado
                </button>
              ) : (
                <span className="text-xs text-neutral-500">
                  Revisado {monitorDateTime(i.acknowledged_at)}
                </span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">Checks ejecutados</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr className="border-b border-neutral-800">
                <th className="px-4 py-3">Comprobación</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fallos seguidos</th>
                <th className="px-4 py-3">Última revisión</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id} className="border-b border-neutral-800/60 last:border-0">
                  <td className="px-4 py-3 text-white">{c.check_name}</td>
                  <td className={cn("px-4 py-3 font-medium", STATUS_TEXT[c.status])}>{c.status}</td>
                  <td className="px-4 py-3 text-neutral-400">{c.consecutive_failures}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {monitorDateTime(c.last_checked_at)}
                  </td>
                </tr>
              ))}
              {checks.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    Aún no se ha ejecutado ningún diagnóstico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">Historial de incidentes resueltos</h2>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2">
          {history.length === 0 && (
            <p className="py-4 text-center text-sm text-neutral-500">Sin historial todavía.</p>
          )}
          {history.map((i) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/60 py-3 text-sm last:border-0"
            >
              <span className="text-neutral-300">{i.title}</span>
              <span className="text-xs text-neutral-500">
                {orgName(i.org_id)} · resuelto {monitorDateTime(i.resolved_at)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">Entorno</h2>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2">
          {[
            ["Conexión a base de datos", isError ? "Con errores" : "Operativa"],
            ["Organizaciones en base", String(stats?.organizations ?? 0)],
            ["Perfiles registrados", String(stats?.users ?? 0)],
            ["Propiedades registradas", String(stats?.properties ?? 0)],
            ["Entorno", import.meta.env.MODE],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-neutral-800/60 py-3 last:border-0"
            >
              <span className="text-sm text-neutral-400">{label}</span>
              <span className="text-sm font-medium text-white">{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/control/sistema")({
  component: ControlSistema,
});
