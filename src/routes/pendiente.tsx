import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MailQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/pendiente")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acceso pendiente — CasaFlow" },
      {
        name: "description",
        content:
          "Tu cuenta de CasaFlow todavía no está asociada a una empresa. Pide a tu administrador el enlace de invitación.",
      },
      { property: "og:title", content: "Acceso pendiente — CasaFlow" },
      { property: "og:description", content: "Tu cuenta espera la invitación de una empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pendiente,
});

function Pendiente() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function salir() {
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <MailQuestion className="size-6 text-muted-foreground" />
          <CardTitle className="font-display text-xl">Acceso pendiente</CardTitle>
          <CardDescription>
            Tu cuenta aún no pertenece a ninguna empresa. El acceso del personal se otorga solo con
            el enlace de invitación que envía el administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Si ya recibiste el correo de invitación, ábrelo desde este mismo dispositivo y usa el
            botón <strong>Aceptar invitación</strong>.
          </p>
          <Button variant="outline" className="w-full" onClick={salir}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
