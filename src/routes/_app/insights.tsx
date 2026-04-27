import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSubscriptions, useCategories } from "@/lib/data-hooks";
import { monthlyEquivalent, yearlyEquivalent, formatCurrency } from "@/lib/subscriptions";
import { Lightbulb, TrendingDown, AlertTriangle, Trophy, PiggyBank } from "lucide-react";

export const Route = createFileRoute("/_app/insights")({
  component: InsightsPage,
  head: () => ({ meta: [{ title: "Insights — Trackify" }] }),
});

function InsightsPage() {
  const { data: subs = [] } = useSubscriptions();
  const { data: categories = [] } = useCategories();

  const active = subs.filter((s) => s.status === "active");
  const monthly = active.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  const yearly = active.reduce((sum, s) => sum + yearlyEquivalent(s), 0);

  // Top category
  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; value: number; count: number }>();
    for (const s of active) {
      const cat = categories.find((c) => c.id === s.category_id);
      const key = cat?.id ?? "none";
      const name = cat?.name ?? "Sem categoria";
      const color = cat?.color ?? "#94A3B8";
      const prev = map.get(key) ?? { name, color, value: 0, count: 0 };
      map.set(key, { name, color, value: prev.value + monthlyEquivalent(s), count: prev.count + 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [active, categories]);

  const topCat = byCategory[0];
  const mostExpensive = [...active].sort((a, b) => yearlyEquivalent(b) - yearlyEquivalent(a))[0];

  // Inactive heuristic: not used in 60+ days OR no last_used_at and created 30+ days ago
  const inactive = active.filter((s) => {
    if (s.last_used_at) {
      const days = (Date.now() - new Date(s.last_used_at).getTime()) / 86400000;
      return days > 60;
    }
    const created = (Date.now() - new Date(s.created_at).getTime()) / 86400000;
    return created > 30;
  });

  const insights = [
    monthly > 0 && {
      icon: PiggyBank,
      tone: "primary",
      title: `Estás a gastar ${formatCurrency(monthly)} por mês`,
      desc: `O equivalente a ${formatCurrency(yearly)} por ano em subscrições.`,
    },
    topCat && topCat.value > monthly * 0.4 && {
      icon: AlertTriangle,
      tone: "warning",
      title: `${topCat.name} representa ${Math.round((topCat.value / monthly) * 100)}% do teu orçamento`,
      desc: `Tens ${topCat.count} subscrição(ões) nesta categoria. Talvez consigas consolidar.`,
    },
    mostExpensive && {
      icon: Trophy,
      tone: "accent",
      title: `${mostExpensive.name} é a tua subscrição mais cara`,
      desc: `Custa-te ${formatCurrency(yearlyEquivalent(mostExpensive))} por ano.`,
    },
    inactive.length > 0 && {
      icon: TrendingDown,
      tone: "destructive",
      title: `${inactive.length} subscrição(ões) podem estar inativas`,
      desc: `Considera cancelar para poupar até ${formatCurrency(inactive.reduce((s, x) => s + monthlyEquivalent(x), 0))} por mês.`,
    },
  ].filter(Boolean) as { icon: any; tone: string; title: string; desc: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Insights</h1>
        <p className="mt-1 text-muted-foreground">Sugestões personalizadas para poupares.</p>
      </div>

      {active.length === 0 ? (
        <div className="rounded-3xl bg-gradient-warm p-10 text-center shadow-soft">
          <Lightbulb className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-lg font-semibold">Sem dados ainda</p>
          <p className="text-sm text-muted-foreground">Adiciona subscrições para receberes insights.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((i, idx) => (
              <InsightCard key={idx} {...i} />
            ))}
          </div>

          {/* Possibly inactive list */}
          {inactive.length > 0 && (
            <div className="rounded-3xl bg-card p-6 shadow-card">
              <h2 className="mb-1 text-lg font-bold">Possivelmente inativas</h2>
              <p className="mb-4 text-sm text-muted-foreground">Subscrições que podem não estar a ser usadas.</p>
              <ul className="space-y-2">
                {inactive.map((s) => {
                  const cat = categories.find((c) => c.id === s.category_id);
                  return (
                    <li key={s.id} className="flex items-center justify-between rounded-2xl border border-border/60 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                             style={{ background: cat?.color ?? "#94A3B8" }}>
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.last_used_at ? `Última utilização há mais de 60 dias` : "Sem utilização registada"}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-destructive">-{formatCurrency(monthlyEquivalent(s))}/mês</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InsightCard({ icon: Icon, tone, title, desc }: { icon: any; tone: string; title: string; desc: string }) {
  const styles: Record<string, string> = {
    primary: "bg-gradient-primary text-primary-foreground",
    warning: "bg-gradient-warm",
    accent: "bg-gradient-mint",
    destructive: "bg-card border-2 border-destructive/30",
  };
  const isWhite = tone === "primary";
  return (
    <div className={`rounded-3xl p-5 shadow-card ${styles[tone] ?? "bg-card"}`}>
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${isWhite ? "bg-white/20" : "bg-card/70"}`}>
        <Icon className={`h-5 w-5 ${isWhite ? "text-primary-foreground" : "text-primary"}`} />
      </div>
      <h3 className={`font-bold ${isWhite ? "text-primary-foreground" : ""}`}>{title}</h3>
      <p className={`mt-1 text-sm ${isWhite ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{desc}</p>
    </div>
  );
}
