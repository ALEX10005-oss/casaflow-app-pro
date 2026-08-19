import { createFileRoute } from "@tanstack/react-router";
import { usePlatformStats } from "@/lib/platform";

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-800/60 py-3 last:border-0">
      <span className="text-sm text-neutral-400">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function ControlSistema() {
  const { data: stats, isError } = usePlatformStats();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Sistema</h1>
        <p className="text-sm text-neutral-400">Estado técnico de la plataforma.</p>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2">
        <Item label="Conexión a base de datos" value={isError ? "Con errores" : "Operativa"} />
        <Item label="Organizaciones en base" value={String(stats?.organizations ?? 0)} />
        <Item label="Perfiles registrados" value={String(stats?.users ?? 0)} />
        <Item label="Propiedades registradas" value={String(stats?.properties ?? 0)} />
        <Item label="Entorno" value={import.meta.env.MODE} />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/control/sistema")({
  component: ControlSistema,
});
