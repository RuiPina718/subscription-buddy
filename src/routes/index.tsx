import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Bell, Calendar, ChartPie, ShieldCheck, Sparkles, Wallet, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Trackify — Gere as tuas subscrições num único lugar" },
      { name: "description", content: "Centraliza todas as tuas subscrições, vê o que gastas por mês e nunca mais sejas surpreendido por uma cobrança." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
          <Button asChild className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
            <Link to="/signup">Começar grátis</Link>
          </Button>
        </nav>
      </header>

      <main className="container mx-auto px-6 pb-24 pt-12 lg:pt-20">
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-primary shadow-soft">
            <Sparkles className="h-3.5 w-3.5" /> Novo · Insights de poupança
          </span>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Todas as tuas subscrições.{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">Zero surpresas.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            O Trackify ajuda-te a controlar quanto gastas em Netflix, Spotify, software e tudo o resto — num único painel simpático e claro.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              <Link to="/signup">Começar agora <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto mt-24 grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-3xl bg-card p-6 shadow-card transition-base hover:-translate-y-1 hover:shadow-glow">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-warm">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-1.5 text-lg font-bold">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-24 max-w-4xl rounded-[2rem] bg-gradient-primary p-10 text-center shadow-glow md:p-14">
          <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">
            Pronto para parar de pagar pelo que não usas?
          </h2>
          <p className="mt-3 text-primary-foreground/85">
            Cria a tua conta em segundos. Sem cartão de crédito.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-7 shadow-soft">
            <Link to="/signup">Criar conta grátis <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card/40 py-6">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Trackify. Feito com ❤ para quem gosta de saber onde vai o dinheiro.
        </div>
      </footer>
    </div>
  );
}

const features = [
  { icon: Wallet, title: "Centraliza tudo", desc: "Adiciona Netflix, Spotify, ChatGPT… vê tudo num só lugar." },
  { icon: ChartPie, title: "Vê a tua despesa", desc: "Total mensal, anual e distribuição por categoria." },
  { icon: Calendar, title: "Calendário claro", desc: "Sabe exatamente que dia te vão cobrar — sem surpresas." },
  { icon: Bell, title: "Sugestões úteis", desc: "Recebe alertas e dicas para reduzir o que não precisas." },
];
