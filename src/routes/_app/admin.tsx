import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield, Trash2, Plus, ArrowLeft } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Administração — Trackify" }] }),
});

interface AdminRow {
  user_id: string;
  email: string | null;
}

function AdminPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<AdminRow | null>(null);

  useEffect(() => {
    if (!isLoading && isAdmin === false) navigate({ to: "/dashboard" });
  }, [isAdmin, isLoading, navigate]);

  const loadAdmins = async () => {
    setLoadingList(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setAdmins([]);
      setLoadingList(false);
      return;
    }
    // Get emails via auth admin not available client-side; fall back to id only
    setAdmins(ids.map((id) => ({ user_id: id, email: null })));
    setLoadingList(false);
  };

  useEffect(() => {
    if (isAdmin) loadAdmins();
  }, [isAdmin]);

  const addAdmin = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    try {
      // Look up user id by email via profiles (won't work) — use RPC alternative: signed-in user search not allowed.
      // Instead require lookup via user metadata. We'll search profiles by full_name? No — use auth.users not exposed.
      // Workaround: query a postgres function we'll create later. For now try direct via service-less approach:
      const { data, error } = await (supabase.rpc as any)("get_user_id_by_email", { _email: email });
      if (error) throw error;
      if (!data) throw new Error("Utilizador não encontrado");
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: data as string, role: "admin" });
      if (insErr) throw insErr;
      toast.success("Admin adicionado");
      setNewEmail("");
      loadAdmins();
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally {
      setAdding(false);
    }
  };

  const removeAdmin = async (userId: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Admin removido");
      loadAdmins();
    }
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" /> Administração
          </h1>
          <p className="mt-1 text-muted-foreground">Gere os administradores da aplicação.</p>
        </div>
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card space-y-4">
        <h2 className="text-lg font-bold">Adicionar administrador</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <Label htmlFor="email">Email do utilizador</Label>
            <Input
              id="email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="utilizador@exemplo.com"
            />
          </div>
          <Button onClick={addAdmin} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">O utilizador tem de ter conta criada.</p>
      </section>

      <section className="rounded-3xl bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold mb-4">Administradores atuais ({admins.length})</h2>
        {loadingList ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem administradores.</p>
        ) : (
          <ul className="divide-y divide-border">
            {admins.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between py-3">
                <code className="text-xs text-muted-foreground">{a.user_id}</code>
                <Button variant="ghost" size="icon" onClick={() => removeAdmin(a.user_id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
