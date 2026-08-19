import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { money, shortDate, useGuests, useProperties, useReservations } from "@/lib/casaflow";

export const Route = createFileRoute("/_authenticated/huespedes")({
  head: () => ({
    meta: [
      { title: "Huéspedes e historial de estancias — CasaFlow" },
      {
        name: "description",
        content: "Ficha unificada de huéspedes con historial de estancias, gasto acumulado y canal de origen.",
      },
      { property: "og:title", content: "Huéspedes — CasaFlow" },
      { property: "og:description", content: "Historial y valor por huésped de tu cartera vacacional." },
    ],
  }),
  component: Huespedes,
});

function Huespedes() {
  const { data: guests = [] } = useGuests();
  const { data: reservations = [] } = useReservations();
  const { data: properties = [] } = useProperties();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));

  const rows = guests
    .map((g) => {
      const stays = reservations.filter((r) => r.guest_id === g.id);
      return {
        ...g,
        stays,
        total: stays.reduce((s, r) => s + Number(r.total_amount), 0),
      };
    })
    .filter((g) => `${g.full_name} ${g.email ?? ""} ${g.country ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.total - a.total);

  return (
    <AppShell title="Huéspedes" subtitle={`${guests.length} huéspedes registrados`}>
      <Input
        className="mb-4 max-w-sm"
        placeholder="Buscar por nombre, correo o país"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Huésped</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">País</th>
                <th className="px-4 py-3">Estancias</th>
                <th className="px-4 py-3 text-right">Valor acumulado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <Fragment key={g.id}>
                  <tr
                    onClick={() => setOpenId(openId === g.id ? null : g.id)}

                    className="cursor-pointer border-b hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{g.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.email ?? "—"}
                      <br />
                      <span className="text-xs">{g.phone ?? ""}</span>
                    </td>
                    <td className="px-4 py-3">{g.country ?? "—"}</td>
                    <td className="px-4 py-3">{g.stays.length}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(g.total)}</td>
                  </tr>
                  {openId === g.id && (
                    <tr key={`${g.id}-d`} className="border-b bg-muted/20">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="space-y-1.5">
                          {g.stays.map((s) => (
                            <div key={s.id} className="flex flex-wrap justify-between gap-2 text-xs">
                              <span className="font-medium">{propById[s.property_id]?.name}</span>
                              <span className="text-muted-foreground">
                                {shortDate(s.check_in)} → {shortDate(s.check_out)} · {s.channel}
                              </span>
                              <span>{money(Number(s.total_amount))}</span>
                            </div>
                          ))}
                          {g.stays.length === 0 && <p className="text-xs text-muted-foreground">Sin estancias.</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
