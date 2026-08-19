import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  danger: "bg-destructive/12 text-destructive border-destructive/25",
  info: "bg-primary/10 text-primary border-primary/25",
  muted: "bg-muted text-muted-foreground border-border",
};

const MAP: Record<string, { label: string; tone: keyof typeof TONES }> = {
  confirmada: { label: "Confirmada", tone: "info" },
  en_curso: { label: "En curso", tone: "success" },
  completada: { label: "Completada", tone: "muted" },
  cancelada: { label: "Cancelada", tone: "danger" },
  pagado: { label: "Pagado", tone: "success" },
  pendiente: { label: "Pendiente", tone: "warning" },
  occupied: { label: "Ocupada", tone: "info" },
  available: { label: "Disponible", tone: "success" },
  maintenance: { label: "Mantenimiento", tone: "danger" },
  incidencia: { label: "Incidencia", tone: "danger" },
  nueva: { label: "Nueva", tone: "warning" },
  en_proceso: { label: "En proceso", tone: "info" },
  resuelta: { label: "Resuelta", tone: "success" },
  alta: { label: "Alta", tone: "danger" },
  media: { label: "Media", tone: "warning" },
  baja: { label: "Baja", tone: "muted" },
  normal: { label: "Normal", tone: "muted" },
  urgente: { label: "Urgente", tone: "danger" },
  connected: { label: "Conectado", tone: "success" },
  syncing: { label: "Sincronizando", tone: "warning" },
  error: { label: "Error", tone: "danger" },
  critical: { label: "Crítica", tone: "danger" },
  warning: { label: "Atención", tone: "warning" },
  info: { label: "Informativa", tone: "info" },
  active: { label: "Activo", tone: "success" },
  suspended: { label: "Suspendido", tone: "danger" },
  entregado: { label: "Entregado", tone: "success" },
  leido: { label: "Leído", tone: "success" },
  enviado: { label: "Enviado", tone: "info" },
  fallido: { label: "Fallido", tone: "danger" },
};

export function StatusPill({ value, className }: { value: string; className?: string }) {
  const entry = MAP[value] ?? { label: value, tone: "muted" as const };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        TONES[entry.tone],
        className,
      )}
    >
      {entry.label}
    </span>
  );
}
