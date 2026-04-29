import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useCreateCategory, useUpdateCategoryColor } from "@/lib/data-hooks";
import { useIsAdmin } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Definições — Trackify" }] }),
});

function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const { data: categories = [] } = useCategories();
  const { data: isAdmin = false } = useIsAdmin();
  const createCat = useCreateCategory();
  const updateColor = useUpdateCategoryColor();
  const [newCat, setNewCat] = useState("");
  const [newColor, setNewColor] = useState("#FF6B9D");

  const handleColorChange = async (id: string, color: string) => {
    try {
      await updateColor.mutateAsync({ id, color });
    } catch (e: any) {
      toast.error("Erro a atualizar cor", { description: e.message });
    }
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (data?.full_name) setName(data.full_name);
    })();
  }, [user]);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setSavingName(false);
    if (error) toast.error("Erro a guardar", { description: error.message });
    else toast.success("Perfil atualizado");
  };

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    try {
      await createCat.mutateAsync({ name: newCat, color: newColor, icon: "tag" });
      toast.success("Categoria criada");
      setNewCat("");
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    }
  };

  const customCats = categories.filter((c) => !c.is_default);
  const defaultCats = categories.filter((c) => c.is_default);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Definições</h1>
          <p className="mt-1 text-muted-foreground">Gere o teu perfil e categorias.</p>
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link to="/admin"><Shield className="mr-1.5 h-4 w-4" /> Admin</Link>
          </Button>
        )}
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">Perfil</h2>
        <form onSubmit={saveName} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="bg-gradient-primary text-primary-foreground shadow-glow" disabled={savingName}>
              {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">Categorias</h2>
        <p className="text-sm text-muted-foreground">Cria categorias personalizadas além das predefinidas.</p>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Predefinidas</p>
          <div className="flex flex-wrap gap-2">
            {defaultCats.map((c) => (
              <label key={c.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium transition-base hover:bg-secondary/80">
                <input
                  type="color"
                  value={c.color}
                  onChange={(e) => handleColorChange(c.id, e.target.value)}
                  className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  style={{ backgroundColor: c.color }}
                  aria-label={`Cor de ${c.name}`}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        {customCats.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personalizadas</p>
            <div className="flex flex-wrap gap-2">
              {customCats.map((c) => (
                <label key={c.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent/40 px-3 py-1.5 text-sm font-medium transition-base hover:bg-accent/60">
                  <input
                    type="color"
                    value={c.color}
                    onChange={(e) => handleColorChange(c.id, e.target.value)}
                    className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                    style={{ backgroundColor: c.color }}
                    aria-label={`Cor de ${c.name}`}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={addCategory} className="mt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <Label htmlFor="newCat">Nova categoria</Label>
            <Input id="newCat" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ex: Educação" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color">Cor</Label>
            <input id="color" type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                   className="h-10 w-16 cursor-pointer rounded-xl border border-border bg-card" />
          </div>
          <Button type="submit" disabled={createCat.isPending}>
            {createCat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Adicionar
          </Button>
        </form>
      </section>
    </div>
  );
}
