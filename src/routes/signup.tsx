import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Criar conta — Trackify" }] }),
});

function SignupPage() {
  const { user, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard" });
  }, [user, authLoading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password muito curta", { description: "Usa pelo menos 6 caracteres." });
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password, name);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error });
    } else {
      toast.success("Conta criada! 🎉", { description: "A entrar..." });
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero">
      <header className="container mx-auto px-6 py-6"><Link to="/"><Logo /></Link></header>
      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-card md:p-10">
          <h1 className="text-3xl font-bold tracking-tight">Criar conta</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Começa a controlar as tuas subscrições hoje.</p>
          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="O teu nome" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tens conta?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">Entra aqui</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
