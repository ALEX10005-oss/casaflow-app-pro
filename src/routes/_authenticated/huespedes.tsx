import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
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

type GuestForm = {
  full_name: string;
  email: string;
  phone: string;
  country: string;
};

function Huespedes() {
  const qc = useQueryClient();
  const { data: guests = [] } = useGuests();
  const { data: reservations = [] } = useReservations();
  const { data: properties = [] } = useProperties();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GuestForm>({ full_name: "", email: "", phone: "", country: "" });
  const propById = Object.fromEntries(properties.map((p) => [p.id, p]));

  const saveGuest = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: GuestForm }) => {
      const { error } = await supabase
        .from("guests")
        .update({
          full_name: values.full_name.trim(),
          email: values.email.trim() || null,
          phone: values.phone.trim() || null,
          country: values.country.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      setEditingId(null);
      toast.success("Información del huésped actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEditing = (guest: (typeof guests)[number]) => {
    setEditingId(guest.id);
    setForm({
      full_name: guest.full_name ?? "",
      email: guest.email ?? "",
      phone: guest.phone ?? "",
      country: guest.country ?? "",
    });
  };

  const rows = guests
    .map((g) => {
      const stays = reservations.filter((r) => r.guest_id === g.id);
      return {
        ...g,
        stays,
        total: stays.reduce((s, r) => s + Number(r.total_amount), 0),
      };
    })
    .filter((g) => `${g.full_name} ${g.email ?? ""} ${g.phone ?? ""} ${g.country ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.total - a.total);

  return (
    <AppShell title="Huéspedes" subtitle={`${guests.length} huéspedes registrados`}>
      <Input
        className="mb-4 max-w-sm"
        placeholder="Buscar por nombre, correo, teléfono o país"
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
                    onClick={() => {
                      setOpenId(openId === g.id ? null : g.id);
                      if (openId === g.id) setEditingId(null);
                    }}
                    className="cursor-pointer border-b hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      {g.full_name}
                      <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">Toca para ver la ficha completa</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.email ?? "—"}
                      <br />
                      <span className="text-xs">{g.phone ?? "Sin teléfono"}</span>
                    </td>
                    <td className="px-4 py-3">{g.country ?? "—"}</td>
                    <td className="px-4 py-3">{g.stays.length}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(g.total)}</td>
                  </tr>
                  {openId === g.id && (
                    <tr key={`${g.id}-d`} className="border-b bg-muted/20">
                      <td colSpan={5} className="px-4 py-5">
                        <div className="space-y-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ficha del huésped</p>
                              <h2 className="text-lg font-semibold">{g.full_name}</h2>
                            </div>
                            {editingId !== g.id && (
                              <Button size="sm" variant="outline" onClick={() => startEditing(g)}>
                                Editar información
                              </Button>
                            )}
                          </div>

                          {editingId === g.id ? (
                            <div className="rounded-lg border bg-card p-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">Nombre completo</span>
                                  <Input
                                    value={form.full_name}
                                    onChange={(e) => setForm((v) => ({ ...v, full_name: e.target.value }))}
                                  />
                                </label>
                                <label className="space-y-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">Correo electrónico</span>
                                  <Input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                                  />
                                </label>
                                <label className="space-y-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">Teléfono</span>
                                  <Input
                                    value={form.phone}
                                    onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
                                  />
                                </label>
                                <label className="space-y-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">País</span>
                                  <Input
                                    value={form.country}
                                    onChange={(e) => setForm((v) => ({ ...v, country: e.target.value }))}
                                  />
                                </label>
                              </div>
                              <div className="mt-4 flex flex-wrap justify-end gap-2">
                                <Button variant="ghost" onClick={() => setEditingId(null)} disabled={saveGuest.isPending}>
                                  Cancelar
                                </Button>
                                <Button
                                  onClick={() => saveGuest.mutate({ id: g.id, values: form })}
                                  disabled={saveGuest.isPending || !form.full_name.trim()}
                                >
                                  {saveGuest.isPending ? "Guardando..." : "Guardar cambios"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs text-muted-foreground">Correo</p>
                                <p className="mt-1 break-all font-medium">{g.email ?? "No registrado"}</p>
                              </div>
                              <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs text-muted-foreground">Teléfono</p>
                                <p className="mt-1 font-medium">{g.phone ?? "No registrado"}</p>
                              </div>
                              <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs text-muted-foreground">País</p>
                                <p className="mt-1 font-medium">{g.country ?? "No registrado"}</p>
                              </div>
                              <div className="rounded-lg border bg-card p-3">
                                <p className="text-xs text-muted-foreground">Estancias</p>
                                <p className="mt-1 font-medium">{g.stays.length}</p>
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial de reservas</p>
                              <span className="text-xs text-muted-foreground">Total {money(g.total)}</span>
                            </div>
                            <div className="overflow-x-auto rounded-lg border bg-card">
                              <table className="w-full min-w-[620px] text-xs">
                                <thead className="border-b bg-muted/30 text-left text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2">Propiedad</th>
                                    <th className="px-3 py-2">Entrada</th>
                                    <th className="px-3 py-2">Salida</th>
                                    <th className="px-3 py-2">Canal</th>
                                    <th className="px-3 py-2">Estado</th>
                                    <th className="px-3 py-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.stays.map((s) => (
                                    <tr key={s.id} className="border-b last:border-b-0">
                                      <td className="px-3 py-2 font-medium">{propById[s.property_id]?.name ?? "—"}</td>
                                      <td className="px-3 py-2">{shortDate(s.check_in)}</td>
                                      <td className="px-3 py-2">{shortDate(s.check_out)}</td>
                                      <td className="px-3 py-2">{s.channel}</td>
                                      <td className="px-3 py-2 capitalize">{s.status}</td>
                                      <td className="px-3 py-2 text-right">{money(Number(s.total_amount))}</td>
                                    </tr>
                                  ))}
                                  {g.stays.length === 0 && (
                                    <tr>
                                      <td colSpan={6} className="px-3 py-5 text-center text-muted-foreground">Sin estancias.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No se encontraron huéspedes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
