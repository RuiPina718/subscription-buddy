import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Shield, Trash2, Plus, ArrowLeft, Search, Users, ShieldCheck, ShieldOff, UserX, Mail, MailWarning } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Administração — Trackify" }] }),
});

interface AdminUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  is_admin: boolean;
  subscription_count: number;
  active_subscription_count: number;
  monthly_total: number;
}

type ConfirmAction =
  | { type: "remove-admin"; user: AdminUser }
  | { type: "make-admin"; user: AdminUser }
  | { type: "delete-user"; user: AdminUser };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);
}

function AdminPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "admins" | "unconfirmed">("all");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    if (!isLoading && isAdmin === false) navigate({ to: "/dashboard" });
  }, [isAdmin, isLoading, navigate]);

  const loadUsers = async () => {
    setLoadingList(true);
    const { data, error } = await (supabase.rpc as any)("admin_list_users");
    if (error) toast.error("Erro a carregar utilizadores", { description: error.message });
    else setUsers((data ?? []) as AdminUser[]);
    setLoadingList(false);
  };

  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin]);

  const addAdminByEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_user_id_by_email", { _email: email });
      if (error) throw error;
      if (!data) throw new Error("Utilizador não encontrado");
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: data as string, role: "admin" });
      if (insErr) throw insErr;
      toast.success("Admin adicionado");
      setNewEmail("");
      loadUsers();
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally {
      setAdding(false);
    }
  };

  const grantAdmin = async (u: AdminUser) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: u.user_id, role: "admin" });
    if (error) toast.error("Erro", { description: error.message });
    else { toast.success(`${u.email} é agora admin`); loadUsers(); }
  };

  const revokeAdmin = async (u: AdminUser) => {
    const { error } = await supabase.from("user_roles").delete()
      .eq("user_id", u.user_id).eq("role", "admin");
    if (error) toast.error("Erro", { description: error.message });
    else { toast.success("Admin removido"); loadUsers(); }
  };

  const deleteUser = async (u: AdminUser) => {
    const { error } = await (supabase.rpc as any)("admin_remove_user", { _user_id: u.user_id });
    if (error) toast.error("Erro", { description: error.message });
    else { toast.success(`Utilizador ${u.email} eliminado`); loadUsers(); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "admins" && !u.is_admin) return false;
      if (filter === "unconfirmed" && u.email_confirmed_at) return false;
      if (!q) return true;
      return (u.email ?? "").toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
    });
  }, [users, search, filter]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter((u) => u.is_admin).length,
    unconfirmed: users.filter((u) => !u.email_confirmed_at).length,
    totalSubs: users.reduce((s, u) => s + Number(u.subscription_count || 0), 0),
  }), [users]);

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
          <p className="mt-1 text-muted-foreground">Gere utilizadores e administradores.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Utilizadores" value={stats.total} />
        <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Admins" value={stats.admins} />
        <StatCard icon={<MailWarning className="h-4 w-4" />} label="Por confirmar" value={stats.unconfirmed} />
        <StatCard icon={<Mail className="h-4 w-4" />} label="Subscrições" value={stats.totalSubs} />
      </div>

      {/* Add admin by email */}
      <section className="rounded-3xl bg-card p-6 shadow-card space-y-4">
        <h2 className="text-lg font-bold">Adicionar admin por email</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <Label htmlFor="email">Email do utilizador</Label>
            <Input id="email" type="email" value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)} placeholder="utilizador@exemplo.com" />
          </div>
          <Button onClick={addAdminByEmail} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">A conta tem de já existir.</p>
      </section>

      {/* Users table */}
      <section className="rounded-3xl bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold">Utilizadores ({filtered.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Procurar email ou nome" className="pl-8 w-[220px]" />
            </div>
            <div className="flex gap-1">
              {(["all", "admins", "unconfirmed"] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}>
                  {f === "all" ? "Todos" : f === "admins" ? "Admins" : "Não confirmados"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {loadingList ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem utilizadores.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilizador</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Subs</TableHead>
                  <TableHead className="text-right">Mensal</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const isSelf = u.user_id === user?.id;
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{u.full_name || "—"}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.is_admin && <Badge variant="default" className="gap-1"><Shield className="h-3 w-3" />Admin</Badge>}
                          {!u.email_confirmed_at && <Badge variant="outline" className="text-amber-600 border-amber-600/40">Por confirmar</Badge>}
                          {isSelf && <Badge variant="secondary">Tu</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u.active_subscription_count}/{u.subscription_count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(Number(u.monthly_total))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(u.created_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(u.last_sign_in_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {u.is_admin ? (
                            <Button size="icon" variant="ghost" disabled={isSelf}
                              title={isSelf ? "Não te podes remover" : "Remover admin"}
                              onClick={() => setConfirm({ type: "remove-admin", user: u })}>
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" title="Tornar admin"
                              onClick={() => setConfirm({ type: "make-admin", user: u })}>
                              <ShieldCheck className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" disabled={isSelf}
                            title={isSelf ? "Não te podes eliminar" : "Eliminar utilizador"}
                            onClick={() => setConfirm({ type: "delete-user", user: u })}>
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "delete-user" && "Eliminar utilizador?"}
              {confirm?.type === "remove-admin" && "Remover privilégios de admin?"}
              {confirm?.type === "make-admin" && "Tornar admin?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "delete-user" && (
                <>Vais eliminar permanentemente a conta de <b>{confirm.user.email}</b> e todos os dados associados (subscrições, categorias, perfil). Esta ação <b>não pode ser revertida</b>.</>
              )}
              {confirm?.type === "remove-admin" && (
                <>Vais retirar o acesso administrativo a <b>{confirm.user.email}</b>. A conta mantém-se ativa.</>
              )}
              {confirm?.type === "make-admin" && (
                <>Vais conceder acesso administrativo total a <b>{confirm.user.email}</b>.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.type !== "make-admin" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={async () => {
                if (!confirm) return;
                if (confirm.type === "delete-user") await deleteUser(confirm.user);
                if (confirm.type === "remove-admin") await revokeAdmin(confirm.user);
                if (confirm.type === "make-admin") await grantAdmin(confirm.user);
                setConfirm(null);
              }}
            >Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        {icon}{label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
