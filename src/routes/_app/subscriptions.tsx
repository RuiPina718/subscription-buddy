import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSubscriptions, useCategories, useDeleteSubscription, useToggleSubscriptionStatus } from "@/lib/data-hooks";
import { formatCurrency, daysUntil } from "@/lib/subscriptions";
import type { Subscription } from "@/lib/subscriptions";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Search, Filter } from "lucide-react";
import { SubscriptionFormDialog } from "@/components/SubscriptionFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export const Route = createFileRoute("/_app/subscriptions")({
  component: SubsPage,
  head: () => ({ meta: [{ title: "Subscrições — Trackify" }] }),
});

function SubsPage() {
  const { data: subs = [], isLoading } = useSubscriptions();
  const { data: categories = [] } = useCategories();
  const del = useDeleteSubscription();
  const toggle = useToggleSubscriptionStatus();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Subscription | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = subs.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== "all" && s.category_id !== filterCat) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Subscrições</h1>
          <p className="mt-1 text-muted-foreground">Gere todas as tuas subscrições.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-primary-foreground shadow-glow">
          <Plus className="mr-1.5 h-4 w-4" /> Nova
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-2xl bg-card p-4 shadow-soft">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Procurar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44"><Filter className="mr-1.5 h-4 w-4" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-muted-foreground">A carregar...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-gradient-warm p-10 text-center shadow-soft">
          <p className="text-lg font-semibold">Nenhuma subscrição encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {subs.length === 0 ? "Adiciona a tua primeira subscrição." : "Tenta ajustar os filtros."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const cat = categories.find((c) => c.id === s.category_id);
            const days = daysUntil(s.next_billing_date);
            const isInactive = s.status === "cancelled";
            return (
              <div key={s.id} className={`group rounded-3xl bg-card p-5 shadow-card transition-base hover:-translate-y-0.5 hover:shadow-glow ${isInactive ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white"
                         style={{ background: cat?.color ?? "#94A3B8" }}>
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold leading-tight">{s.name}</p>
                      {cat && <p className="text-xs text-muted-foreground">{cat.name}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(s); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{formatCurrency(Number(s.amount), s.currency)}</span>
                  <span className="text-xs text-muted-foreground">/ {s.billing_cycle === "monthly" ? "mês" : "ano"}</span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Próx: {format(new Date(s.next_billing_date), "d MMM", { locale: pt })}
                    {!isInactive && days >= 0 && days <= 3 && (
                      <span className="ml-1.5 rounded-full bg-warning/20 px-2 py-0.5 font-semibold text-warning-foreground">
                        {days === 0 ? "Hoje" : `${days}d`}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={s.status === "active"}
                      onCheckedChange={async (v) => {
                        await toggle.mutateAsync({ id: s.id, status: v ? "active" : "cancelled" });
                        toast.success(v ? "Reativada" : "Cancelada");
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SubscriptionFormDialog open={open} onOpenChange={setOpen} editing={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar subscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais eliminar permanentemente "{confirmDelete?.name}". Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                await del.mutateAsync(confirmDelete.id);
                toast.success("Subscrição eliminada");
                setConfirmDelete(null);
              }}
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
