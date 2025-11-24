"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoginForm({ 
  className,
  ...props
}: Readonly<React.ComponentPropsWithoutRef<"div">>) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Invalid email or password");
        setIsLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8 w-full" onSubmit={handleSubmit}>
            <div className="flex flex-col items-center gap-2 text-center mb-6">
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="text-muted-foreground text-balance">
                Login with your email and password
              </p>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {error ? (
                <div className="text-destructive text-sm">{error}</div>
              ) : null}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </div>
          </form>
          <div className="bg-muted/50 p-6 md:p-8 flex items-center justify-center w-full">
            <div className="max-h-128 overflow-y-auto w-full max-w-md mx-auto text-balance text-muted-foreground text-xs space-y-6">
              <div>
                <span className="font-semibold">Consentiment informat</span><br />
                En accedir a aquesta eina, manifesto que entenc que faré ús d'una versió basada en GPT-4o desenvolupada exclusivament per a aquesta activitat. Amb les credencials anonimitzades que se m'han facilitat, podré iniciar sessió i utilitzar l'eina únicament per a la realització de la tasca encomanada. Em comprometo a no introduir-hi cap dada personal o identificativa. Igualment, entenc que totes les meves interaccions amb l'eina formaran part d'un estudi de recerca dut a terme per Judith Raigal i Nune Ayvazyan, que aquestes dades seran registrades de manera segura i anonimitzada, i que puc adreçar qualsevol consulta a Judith Raigal (judith.raigal@urv.cat).
              </div>
              <div>
                <span className="font-semibold">Consentimiento informado</span><br />
                Al acceder a esta herramienta, manifiesto que entiendo que haré uso de una versión basada en GPT-4o desarrollada exclusivamente para esta actividad. Con las credenciales anonimizadas que se me han facilitado, podré iniciar sesión y utilizar la herramienta únicamente para la realización de la tarea asignada. Me comprometo a no introducir ningún dato personal o identificativo. Asimismo, entiendo que todas mis interacciones con la herramienta formarán parte de un estudio de investigación llevado a cabo por Judith Raigal y Nune Ayvazyan, que dichos datos serán registrados de manera segura y anonimizados, y que puedo dirigir cualquier consulta a Judith Raigal (judith.raigal@urv.cat).
              </div>
              <div>
                <span className="font-semibold">Informed consent</span><br />
                By accessing this tool, I acknowledge that I will be using a GPT-4o-based system developed exclusively for this activity. The anonymised credentials provided to me allow me to log in and use the tool solely for completing the assigned task. I agree not to enter any personal or identifying information. I also understand that all my interactions with the tool will form part of a research study conducted by Judith Raigal and Nune Ayvazyan, that these data will be securely recorded and anonymised, and that I may contact Judith Raigal if I have any questions (judith.raigal@urv.cat).
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
