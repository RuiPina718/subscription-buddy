import { useState, useEffect, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories, useUpsertSubscription, type SubscriptionInput } from "@/lib/data-hooks";
import type { Subscription } from "@/lib/subscriptions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Subscription | null;
}

export function SubscriptionFormDialog({ open, onOpenChange, editing }: Props) {
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertSubscription();

  const [form, setForm] = useState<SubscriptionInput>({
    name: "",
    category_id: null,
    amount: 0,
    currency: "EUR",
    billing_cycle: "monthly",
    billing_day: 1,
    notes: "",
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        category_id: editing.category_id,
        amount: Number(editing.amount),
        currency: editing.currency,
        billing_cycle: editing.billing_cycle,
        billing_day: editing.billing_day,
        notes: editing.notes ?? "",
      });
    } else if (open) {
      setForm({
        name: "", category_id: categories[0]?.id ?? null, amount: 0, currency: "EUR",
        billing_cycle: "monthly", billing_day: new Date().getDate(), notes: "",
      });
    }
  }, [editing, open, categories]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Indica um nome"); return; }
    if (form.amount < 0) { toast.error("Valor inválido"); return; }
    try {
      await upsert.mutateAsync({ id: editing?.id, input: form });
      toast.success(editing ? "Subscrição atualizada" : "Subscrição adicionada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao guardar", { description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar subscrição" : "Nova subscrição"}</DialogTitle>
          <DialogDescription>
            {editing ? "Atualiza os detalhes da subscrição." : "Adiciona um novo serviço para acompanhar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome do serviço</Label>
            <Input id="name" placeholder="Ex: Netflix" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor</Label>
              <Input id="amount" type="number" step="0.01" min="0" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Moeda</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="GBP">GBP £</SelectItem>
                  <SelectItem value="BRL">BRL R$</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cycle">Ciclo</Label>
              <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v as any })}>
                <SelectTrigger id="cycle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="day">Dia de cobrança</Label>
              <Input id="day" type="number" min={1} max={31} value={form.billing_day}
                onChange={(e) => setForm({ ...form, billing_day: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat">Categoria</Label>
            <Select value={form.category_id ?? "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}>
              <SelectTrigger id="cat"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea id="notes" rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={upsert.isPending} className="bg-gradient-primary text-primary-foreground shadow-glow">
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Guardar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
