import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSubscriptions, useCategories } from "@/lib/data-hooks";
import { monthlyEquivalent, yearlyEquivalent, formatCurrency, daysUntil } from "@/lib/subscriptions";
import { Wallet, TrendingUp, ListChecks, AlertCircle, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Trackify" }] }),
});

function DashboardPage() {
  const { data: subs = [], isLoading } = useSubscriptions();
  const { data: categories = [] } = useCategories();

  const active = subs.filter((s) => s.status === "active");
  const monthlyTotal = active.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  const yearlyTotal = active.reduce((sum, s) => sum + yearlyEquivalent(s), 0);

  const upcoming = useMemo(
    () => active
      .map((s) => ({ ...s, days: daysUntil(s.next_billing_date) }))
      .filter((s) => s.days >= 0 && s.days <= 7)
      .sort((a, b) => a.days - b.days),
    [active]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; value: number }>();
    for (const s of active) {
      const cat = categories.find((c) => c.id === s.category_id);
      const key = cat?.id ?? "none";
      const name = cat?.name ?? "Sem categoria";
      const color = cat?.color ?? "#94A3B8";
      const prev = map.get(key)?.value ?? 0;
      map.set(key, { name, color, value: prev + monthlyEquivalent(s) });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [active, categories]);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Olá! 👋</h1>
          <p className="mt-1 text-muted-foreground">Aqui está um resumo das tuas subscrições.</p>
        </div>
        <Button asChild className="bg-gradient-primary text-primary-foreground shadow-glow">
          <Link to="/subscriptions"><Plus className="mr-1.5 h-4 w-4" /> Nova subscrição</Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Gasto mensal" value={formatCurrency(monthlyTotal)} gradient="bg-gradient-primary" textWhite />
        <StatCard icon={TrendingUp} label="Gasto anual" value={formatCurrency(yearlyTotal)} />
        <StatCard icon={ListChecks} label="Subscrições ativas" value={String(active.length)} />
        <StatCard icon={AlertCircle} label="Próximos 7 dias" value={String(upcoming.length)} highlight={upcoming.length > 0} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Distribution */}
        <div className="rounded-3xl bg-card p-6 shadow-card lg:col-span-3">
          <h2 className="text-lg font-bold">Distribuição por categoria</h2>
          <p className="mb-4 text-sm text-muted-foreground">Gasto mensal equivalente</p>
          {byCategory.length === 0 ? (
            <EmptyState text="Adiciona a tua primeira subscrição para veres aqui o gráfico." />
          ) : (
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2">
                {byCategory.map((c) => (
                  <li key={c.name} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                    <span className="flex items-center gap-2.5 text-sm font-medium">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                    <span className="text-sm font-semibold">{formatCurrency(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="rounded-3xl bg-card p-6 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">A chegar</h2>
            <Link to="/calendar" className="text-xs font-semibold text-primary hover:underline">Ver tudo <ArrowRight className="ml-0.5 inline h-3 w-3" /></Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState text="Sem cobranças nos próximos 7 dias 🎉" />
          ) : (
            <ul className="space-y-2.5">
              {upcoming.slice(0, 5).map((s) => {
                const cat = categories.find((c) => c.id === s.category_id);
                return (
                  <li key={s.id} className="flex items-center justify-between rounded-2xl border border-border/60 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                           style={{ background: cat?.color ?? "#94A3B8" }}>
                        {s.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.days === 0 ? "Hoje" : s.days === 1 ? "Amanhã" : `Em ${s.days} dias`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold">{formatCurrency(Number(s.amount), s.currency)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {!isLoading && subs.length === 0 && (
        <div className="rounded-3xl bg-gradient-warm p-8 text-center shadow-card">
          <h3 className="text-xl font-bold">Vamos começar! 🚀</h3>
          <p className="mt-1.5 text-muted-foreground">Adiciona a tua primeira subscrição para ver o que estás a gastar.</p>
          <Button asChild className="mt-5 bg-gradient-primary text-primary-foreground shadow-glow">
            <Link to="/subscriptions"><Plus className="mr-1.5 h-4 w-4" /> Adicionar agora</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, gradient, textWhite, highlight }: {
  icon: any; label: string; value: string; gradient?: string; textWhite?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`rounded-3xl p-5 shadow-card ${gradient ?? "bg-card"} ${highlight ? "ring-2 ring-warning" : ""}`}>
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${textWhite ? "bg-white/20" : "bg-secondary"}`}>
        <Icon className={`h-5 w-5 ${textWhite ? "text-primary-foreground" : "text-primary"}`} />
      </div>
      <p className={`text-xs font-medium uppercase tracking-wider ${textWhite ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${textWhite ? "text-primary-foreground" : ""}`}>{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex h-40 items-center justify-center rounded-2xl bg-muted/40 text-sm text-muted-foreground">{text}</div>;
}
