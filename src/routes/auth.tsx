import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso a CasaFlow — Panel de operación" },
      {
        name: "description",
        content:
          "Ingresa a CasaFlow para administrar reservas, limpieza, mantenimiento y finanzas de tus propiedades vacacionales.",
      },
      { property: "og:title", content: "Acceso a CasaFlow" },
      { property: "og:description", content: "Panel de operación para administradores de propiedades vacacionales." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/panel", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/panel", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/panel`,
        data: { first_name: firstName, last_name: lastName, company },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cuenta creada. Ya puedes entrar al panel.");
    navigate({ to: "/panel", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link to="/" className="font-display text-xl font-semibold text-sidebar-accent-foreground">
          CasaFlow
        </Link>
        <div className="space-y-4">
          <h2 className="font-display text-3xl font-semibold text-sidebar-accent-foreground">
            Una sola operación para todas tus propiedades.
          </h2>
          <p className="max-w-md text-sm text-sidebar-foreground/70">
            Reserva externa → CasaFlow → calendario → huésped → WhatsApp → operación → finanzas →
            reportes.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Acceso restringido al personal autorizado de cada empresa administradora.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Acceso al panel</CardTitle>
            <CardDescription>Usa la cuenta asignada por el administrador de tu empresa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="in">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="up">Registrar empresa</TabsTrigger>
              </TabsList>

              <TabsContent value="in">
                <form onSubmit={signIn} className="space-y-4 pt-4">
                  <Field id="email" label="Correo corporativo" value={email} onChange={setEmail} type="email" />
                  <Field id="pass" label="Contraseña" value={password} onChange={setPassword} type="password" />
                  <Button type="submit" className="w-full" disabled={loading}>
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="up">
                <form onSubmit={signUp} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="fn" label="Nombre" value={firstName} onChange={setFirstName} />
                    <Field id="ln" label="Apellido" value={lastName} onChange={setLastName} />
                  </div>
                  <Field id="co" label="Empresa" value={company} onChange={setCompany} />
                  <Field id="email2" label="Correo corporativo" value={email} onChange={setEmail} type="email" />
                  <Field id="pass2" label="Contraseña" value={password} onChange={setPassword} type="password" />
                  <Button type="submit" className="w-full" disabled={loading}>
                    Crear acceso
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="mt-5 text-xs text-muted-foreground">
              El acceso se otorga por empresa. Los roles y permisos se administran desde Equipo y roles.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} required onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
