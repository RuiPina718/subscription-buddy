import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCategories, useSubscriptions } from "@/lib/data-hooks";
import { useBudgets, useUpsertBudget, useDeleteBudget } from "@/lib/budgets-hooks";
import { monthlyEquivalent, formatCurrency } from "@/lib/subscriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/budgets")({
  component: BudgetsPage,
  head: () => ({ meta: [{ title: "Orçamentos — Trackify" }] }),
});

function BudgetsPage() {
  const { data: categories = [] } = useCategories();
  const { data: subs = [] } = useSubscriptions();
  const { data: budgets = [], isLoading } = useBudgets();
  const upsert = useUpsertBudget();
  const del = useDeleteBudget();

  const spendByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subs) {
      if (s.status !== "active" || !s.category_id) continue;
      map.set(s.category_id, (map.get(s.category_id) ?? 0) + monthlyEquivalent(s));
    }
    return map;
  }, [subs]);

  const budgetByCat = useMemo(() => {
    const map = new Map<string, { id: string; monthly_limit: number }>();
    for (const b of budgets) map.set(b.category_id, { id: b.id, monthly_limit: Number(b.monthly_limit) });
    return map;
  }, [budgets]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Orçamentos</h1>
        <p className="mt-1 text-muted-foreground">Define um limite mensal por categoria e acompanha o teu progresso.</p>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-muted-foreground">A carregar...</p>
      ) : categories.length === 0 ? (
        <div className="rounded-3xl bg-gradient-warm p-10 text-center shadow-soft">
          <p className="text-lg font-semibold">Sem categorias</p>
          <p className="mt-1 text-sm text-muted-foreground">Cria categorias em Definições para começar a definir orçamentos.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {categories.map((c) => {
            const spend = spendByCat.get(c.id) ?? 0;
            const b = budgetByCat.get(c.id);
            return (
              <BudgetRow
                key={c.id}
                category={c}
                spend={spend}
                budget={b}
                onSave={async (value) => {
                  try {
                    await upsert.mutateAsync({ category_id: c.id, monthly_limit: value });
                    toast.success("Orçamento guardado");
                  } catch (e: any) {
                    toast.error("Erro", { description: e.message });
                  }
                }}
                onDelete={async () => {
                  if (!b) return;
                  try {
                    await del.mutateAsync(b.id);
                    toast.success("Orçamento removido");
                  } catch (e: any) {
                    toast.error("Erro", { description: e.message });
                  }
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetRow({
  category,
  spend,
  budget,
  onSave,
  onDelete,
}: {
  category: { id: string; name: string; color: string };
  spend: number;
  budget?: { id: string; monthly_limit: number };
  onSave: (value: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [value, setValue] = useState<string>(budget ? String(budget.monthly_limit) : "");
  const [saving, setSaving] = useState(false);

  const limit = budget?.monthly_limit ?? 0;
  const pct = limit > 0 ? Math.min(100, (spend / limit) * 100) : 0;
  const over = limit > 0 && spend > limit;
  const warn = limit > 0 && pct >= 80 && !over;

  const barColor = over ? "bg-destructive" : warn ? "bg-warning" : "bg-primary";

  const handleSave = async () => {
    const num = Number(value.replace(",", "."));
    if (!Number.isFinite(num) || num < 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    await onSave(num);
    setSaving(false);
  };

  return (
    <div className="rounded-3xl bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: category.color }} />
        <h3 className="font-bold">{category.name}</h3>
        <span className="ml-auto text-sm text-muted-foreground">
          {formatCurrency(spend)} {limit > 0 && <>/ {formatCurrency(limit)}</>}
        </span>
      </div>

      {limit > 0 && (
        <div className="mt-3">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {over ? (
              <span className="font-semibold text-destructive">Acima do orçamento em {formatCurrency(spend - limit)}</span>
            ) : warn ? (
              <span className="font-semibold text-warning-foreground">Atenção: {pct.toFixed(0)}% do orçamento usado</span>
            ) : (
              <>{pct.toFixed(0)}% do orçamento usado</>
            )}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`b-${category.id}`} className="text-xs">Limite mensal (€)</Label>
          <Input
            id={`b-${category.id}`}
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex: 50"
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !value}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="mr-1.5 h-4 w-4" />}
          Guardar
        </Button>
        {budget && (
          <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
