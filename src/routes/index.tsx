import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, LineChart, MessageCircle, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CasaFlow — Operación central para rentas vacacionales" },
      {
        name: "description",
        content:
          "CasaFlow unifica calendario multipropiedad, reservas de Airbnb, Booking y VRBO, limpieza, mantenimiento, WhatsApp y finanzas en un solo panel.",
      },
      { property: "og:title", content: "CasaFlow — Operación central para rentas vacacionales" },
      {
        property: "og:description",
        content: "Un solo panel para calendario, reservas, operación y finanzas de tus propiedades.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: CalendarDays, title: "Calendario PMS multipropiedad", body: "Todas las unidades en una línea de tiempo, con bloqueos y canal de origen visible." },
  { icon: Wrench, title: "Operación ejecutable", body: "Limpieza priorizada por ventana salida-entrada e incidencias que bloquean recepción." },
  { icon: MessageCircle, title: "WhatsApp automatizado", body: "Confirmación, instrucciones de llegada y recordatorio de salida sin intervención manual." },
  { icon: LineChart, title: "Finanzas y reportes", body: "Comisiones por canal, gasto operativo y rentabilidad real por propiedad." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-xl font-semibold">CasaFlow</span>
        <Button asChild size="sm">
          <Link to="/auth">Acceder al panel</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Sparkles className="size-3" /> Plataforma B2B para administradoras vacacionales
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight md:text-6xl">
            Toda tu operación vacacional en un solo flujo.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Reserva externa → calendario → huésped → WhatsApp → limpieza y mantenimiento → finanzas → reportes.
            Sin hojas de cálculo paralelas.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Entrar a CasaFlow <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h2 className="mt-3 font-display text-base font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 rounded-xl border bg-sidebar p-8 text-sidebar-foreground md:grid-cols-3">
            <Stat value="26" label="Propiedades administradas en la cuenta demo" />
            <Stat value="4" label="Canales sincronizados: Airbnb, Booking, VRBO y directo" />
            <Stat value="6" label="Roles operativos con accesos diferenciados" />
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-8 text-center text-xs text-muted-foreground">
        CasaFlow · Plataforma de administración de propiedades vacacionales
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-4xl font-semibold text-sidebar-accent-foreground">{value}</p>
      <p className="mt-1 text-sm text-sidebar-foreground/70">{label}</p>
    </div>
  );
}
