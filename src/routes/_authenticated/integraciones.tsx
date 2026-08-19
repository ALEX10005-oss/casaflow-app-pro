import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntegrations, useReservations } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/integraciones")({
  head: () => ({
    meta: [
      { title: "Integraciones de canales — CasaFlow" },
      {
        name: "description",
        content: "Estado de sincronización con Airbnb, Booking, VRBO y canal directo, con última importación por canal.",
      },
      { property: "og:title", content: "Integraciones — CasaFlow" },
      { property: "og:description", content: "Sincronización de calendarios y reservas de canales externos." },
    ],
  }),
  component: Integraciones,
});

function Integraciones() {
  const { data: integrations = [] } = useIntegrations();
  const { data: reservations = [] } = useReservations();

  const byChannel = reservations.reduce<Record<string, number>>((acc, r) => {
    acc[r.channel] = (acc[r.channel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell title="Integraciones" subtitle="Las reservas se originan en los canales y se consolidan aquí">
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((i) => (
          <Card key={i.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{i.provider}</CardTitle>
              <StatusPill value={i.status} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{i.detail ?? "Sincronización de calendario y reservas."}</p>
              <div className="flex justify-between border-t pt-2 text-xs">
                <span className="text-muted-foreground">Última sincronización</span>
                <span>
                  {i.last_sync
                    ? new Date(i.last_sync).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reservas importadas</span>
                <span>{byChannel[i.provider] ?? 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Alcance</span>
                <span>{i.per_property ? "Por propiedad" : "Cuenta completa"}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
