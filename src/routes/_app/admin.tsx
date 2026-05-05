import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-role";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Loader2, Shield, Plus, ArrowLeft, Search, Users, ShieldCheck, ShieldOff,
  UserX, Mail, MailWarning, Ban, KeyRound, Send, Eye, Download, TrendingUp,
  Euro, Activity, History, Tag, Pencil, Trash2,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useServerFn } from "@tanstack/react-start";
import {
  adminSendPasswordReset, adminResendConfirmation, adminSetUserBanned,
} from "@/server/admin.functions";

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
  banned_until: string | null;
  is_admin: boolean;
  subscription_count: number;
  active_subscription_count: number;
  monthly_total: number;
}

interface GlobalStats {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  unconfirmed_users: number;
  banned_users: number;
  total_admins: number;
  total_subscriptions: number;
  active_subscriptions: number;
  mrr: number;
  arr: number;
  top_services: { name: string; count: number }[];
  by_category: { name: string; color: string; count: number; monthly: number }[];
}

interface AuditEntry {
  id: string;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface DefaultCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
}

interface UserSubRow {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string;
  status: string;
  category_name: string | null;
  category_color: string | null;
  last_used_at: string | null;
  created_at: string;
}

type ConfirmAction =
  | { type: "remove-admin"; user: AdminUser }
  | { type: "make-admin"; user: AdminUser }
  | { type: "delete-user"; user: AdminUser }
  | { type: "ban"; user: AdminUser }
  | { type: "unban"; user: AdminUser }
  | { type: "reset-password"; user: AdminUser }
  | { type: "resend-confirm"; user: AdminUser }
  | { type: "delete-category"; category: DefaultCategory };

const fmtDate = (d: string | null) =>
  !d ? "—" : new Date(d).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);

const isBanned = (u: AdminUser) =>
  !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();

function AdminPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAdmin === false) navigate({ to: "/dashboard" });
  }, [isAdmin, isLoading, navigate]);

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
          <p className="mt-1 text-muted-foreground">Gere utilizadores, categorias e vê estatísticas globais.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="users">Utilizadores</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="users"><UsersTab currentUserId={user?.id} /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ────── Overview ────── */
function OverviewTab() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase.rpc as any)("admin_global_stats");
      if (error) toast.error("Erro a carregar estatísticas", { description: error.message });
      else setStats(data as GlobalStats);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!stats) return <p className="text-sm text-muted-foreground">Sem dados.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Euro className="h-4 w-4" />} label="MRR" value={fmtMoney(Number(stats.mrr))} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="ARR" value={fmtMoney(Number(stats.arr))} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Utilizadores" value={String(stats.total_users)} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Subs ativas" value={`${stats.active_subscriptions}/${stats.total_subscriptions}`} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Novos (7d)" value={String(stats.new_users_7d)} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Novos (30d)" value={String(stats.new_users_30d)} />
        <StatCard icon={<MailWarning className="h-4 w-4" />} label="Por confirmar" value={String(stats.unconfirmed_users)} />
        <StatCard icon={<Ban className="h-4 w-4" />} label="Suspensos" value={String(stats.banned_users)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl bg-card p-6 shadow-card">
          <h3 className="text-base font-bold mb-3">Top 5 serviços</h3>
          {stats.top_services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer>
                <BarChart data={stats.top_services} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-card">
          <h3 className="text-base font-bold mb-3">Por categoria (mensal)</h3>
          {stats.by_category.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={stats.by_category} dataKey="monthly" nameKey="name" outerRadius={90} label>
                    {stats.by_category.map((c, i) => (
                      <Cell key={i} fill={c.color || "#9b87f5"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ────── Users ────── */
function UsersTab({ currentUserId }: { currentUserId: string | undefined }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "admins" | "unconfirmed" | "banned">("all");
  const [sortBy, setSortBy] = useState<"created" | "monthly" | "subs">("created");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [detail, setDetail] = useState<AdminUser | null>(null);

  const sendReset = useServerFn(adminSendPasswordReset);
  const resendConfirm = useServerFn(adminResendConfirmation);
  const setBanned = useServerFn(adminSetUserBanned);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("admin_list_users");
    if (error) toast.error("Erro a carregar utilizadores", { description: error.message });
    else setUsers((data ?? []) as AdminUser[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addAdminByEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_user_id_by_email", { _email: email });
      if (error) throw error;
      if (!data) throw new Error("Utilizador não encontrado");
      const { error: insErr } = await supabase
        .from("user_roles").insert({ user_id: data as string, role: "admin" });
      if (insErr) throw insErr;
      await (supabase.rpc as any)("admin_log_action", { _action: "admin_granted", _target_id: data, _target_email: email });
      toast.success("Admin adicionado");
      setNewEmail(""); load();
    } catch (e: any) { toast.error("Erro", { description: e.message }); }
    finally { setAdding(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users.filter((u) => {
      if (filter === "admins" && !u.is_admin) return false;
      if (filter === "unconfirmed" && u.email_confirmed_at) return false;
      if (filter === "banned" && !isBanned(u)) return false;
      if (!q) return true;
      return (u.email ?? "").toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "monthly") return Number(b.monthly_total) - Number(a.monthly_total);
      if (sortBy === "subs") return Number(b.subscription_count) - Number(a.subscription_count);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [users, search, filter, sortBy]);

  const exportCsv = () => {
    const header = ["email", "nome", "admin", "subs", "subs_ativas", "mensal_eur", "criado", "ultimo_login", "confirmado", "suspenso"];
    const rows = filtered.map((u) => [
      u.email, u.full_name ?? "", u.is_admin ? "sim" : "não",
      u.subscription_count, u.active_subscription_count, Number(u.monthly_total).toFixed(2),
      u.created_at, u.last_sign_in_at ?? "",
      u.email_confirmed_at ? "sim" : "não", isBanned(u) ? "sim" : "não",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `utilizadores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const runConfirm = async (c: ConfirmAction) => {
    try {
      if (c.type === "delete-user") {
        const { error } = await (supabase.rpc as any)("admin_remove_user", { _user_id: c.user.user_id });
        if (error) throw error;
        await (supabase.rpc as any)("admin_log_action", { _action: "user_deleted", _target_id: c.user.user_id, _target_email: c.user.email });
        toast.success(`Utilizador ${c.user.email} eliminado`);
      } else if (c.type === "remove-admin") {
        const { error } = await supabase.from("user_roles").delete()
          .eq("user_id", c.user.user_id).eq("role", "admin");
        if (error) throw error;
        await (supabase.rpc as any)("admin_log_action", { _action: "admin_revoked", _target_id: c.user.user_id, _target_email: c.user.email });
        toast.success("Admin removido");
      } else if (c.type === "make-admin") {
        const { error } = await supabase.from("user_roles").insert({ user_id: c.user.user_id, role: "admin" });
        if (error) throw error;
        await (supabase.rpc as any)("admin_log_action", { _action: "admin_granted", _target_id: c.user.user_id, _target_email: c.user.email });
        toast.success("Admin concedido");
      } else if (c.type === "ban" || c.type === "unban") {
        await setBanned({ data: { userId: c.user.user_id, email: c.user.email!, banned: c.type === "ban" } });
        toast.success(c.type === "ban" ? "Conta suspensa" : "Conta reativada");
      } else if (c.type === "reset-password") {
        await sendReset({ data: { userId: c.user.user_id, email: c.user.email! } });
        toast.success("Email de recuperação enviado");
      } else if (c.type === "resend-confirm") {
        await resendConfirm({ data: { userId: c.user.user_id, email: c.user.email! } });
        toast.success("Convite/confirmação reenviado");
      }
      load();
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Add admin */}
      <section className="rounded-3xl bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold mb-3">Adicionar admin por email</h2>
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
        <p className="text-xs text-muted-foreground mt-2">A conta tem de já existir.</p>
      </section>

      {/* List */}
      <section className="rounded-3xl bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold">Utilizadores ({filtered.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Procurar" className="pl-8 w-[200px]" />
            </div>
            <select className="h-9 rounded-md border bg-background px-2 text-sm"
              value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="created">Mais recentes</option>
              <option value="monthly">Maior gasto</option>
              <option value="subs">Mais subs</option>
            </select>
            <div className="flex gap-1">
              {(["all", "admins", "unconfirmed", "banned"] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                  {f === "all" ? "Todos" : f === "admins" ? "Admins" : f === "unconfirmed" ? "Por confirmar" : "Suspensos"}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
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
                  const isSelf = u.user_id === currentUserId;
                  const banned = isBanned(u);
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
                          {banned && <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" />Suspenso</Badge>}
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
                          <Button size="icon" variant="ghost" title="Ver detalhe" onClick={() => setDetail(u)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Enviar reset password"
                            onClick={() => setConfirm({ type: "reset-password", user: u })}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {!u.email_confirmed_at && (
                            <Button size="icon" variant="ghost" title="Reenviar confirmação"
                              onClick={() => setConfirm({ type: "resend-confirm", user: u })}>
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
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
                            title={banned ? "Reativar" : "Suspender"}
                            onClick={() => setConfirm({ type: banned ? "unban" : "ban", user: u })}>
                            <Ban className={`h-4 w-4 ${banned ? "text-amber-600" : ""}`} />
                          </Button>
                          <Button size="icon" variant="ghost" disabled={isSelf}
                            title={isSelf ? "Não te podes eliminar" : "Eliminar"}
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

      <UserDetailSheet user={detail} onOpenChange={(v) => !v && setDetail(null)} />

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle(confirm)}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc(confirm)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm && (confirm.type === "delete-user" || confirm.type === "ban" || confirm.type === "remove-admin")
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""
              }
              onClick={async () => {
                if (!confirm) return;
                await runConfirm(confirm);
                setConfirm(null);
              }}
            >Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function confirmTitle(c: ConfirmAction | null): string {
  if (!c) return "";
  switch (c.type) {
    case "delete-user": return "Eliminar utilizador?";
    case "remove-admin": return "Remover admin?";
    case "make-admin": return "Tornar admin?";
    case "ban": return "Suspender conta?";
    case "unban": return "Reativar conta?";
    case "reset-password": return "Enviar reset de password?";
    case "resend-confirm": return "Reenviar confirmação?";
    case "delete-category": return "Eliminar categoria?";
  }
}
function confirmDesc(c: ConfirmAction | null): string {
  if (!c) return "";
  switch (c.type) {
    case "delete-user": return `A conta de ${c.user.email} e todos os dados associados serão eliminados permanentemente.`;
    case "remove-admin": return `${c.user.email} deixa de ser administrador.`;
    case "make-admin": return `${c.user.email} terá acesso administrativo total.`;
    case "ban": return `${c.user.email} ficará impedido de iniciar sessão.`;
    case "unban": return `${c.user.email} poderá voltar a iniciar sessão.`;
    case "reset-password": return `Será enviado um email a ${c.user.email} para definir nova password.`;
    case "resend-confirm": return `Será reenviado o email de confirmação a ${c.user.email}.`;
    case "delete-category": return `A categoria “${c.category.name}” será eliminada para todos os utilizadores.`;
  }
}

/* ────── User detail drawer ────── */
function UserDetailSheet({ user, onOpenChange }: { user: AdminUser | null; onOpenChange: (open: boolean) => void }) {
  const [subs, setSubs] = useState<UserSubRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase.rpc as any)("admin_get_user_subscriptions", { _user_id: user.user_id });
      if (error) toast.error("Erro", { description: error.message });
      else setSubs((data ?? []) as UserSubRow[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{user?.full_name || user?.email}</SheetTitle>
          <SheetDescription>{user?.email}</SheetDescription>
        </SheetHeader>
        {user && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={<Activity className="h-4 w-4" />} label="Subs ativas" value={`${user.active_subscription_count}/${user.subscription_count}`} />
              <StatCard icon={<Euro className="h-4 w-4" />} label="Mensal" value={fmtMoney(Number(user.monthly_total))} />
              <StatCard icon={<Mail className="h-4 w-4" />} label="Confirmado" value={user.email_confirmed_at ? "Sim" : "Não"} />
              <StatCard icon={<Activity className="h-4 w-4" />} label="Último login" value={fmtDate(user.last_sign_in_at)} />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Subscrições</h4>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : subs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem subscrições.</p>
              ) : (
                <div className="space-y-2">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.category_color || "#9b87f5" }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.category_name || "Sem categoria"} · {s.status} · próx. {s.next_billing_date}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm tabular-nums shrink-0">
                        {fmtMoney(Number(s.amount))}/{s.billing_cycle === "yearly" ? "ano" : "mês"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ────── Categories (default) ────── */
function CategoriesTab() {
  const [cats, setCats] = useState<DefaultCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DefaultCategory | null>(null);
  const [form, setForm] = useState({ name: "", icon: "tag", color: "#9b87f5" });
  const [confirm, setConfirm] = useState<DefaultCategory | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("categories").select("id,name,icon,color,is_default")
      .eq("is_default", true).order("name");
    if (error) toast.error("Erro", { description: error.message });
    else setCats((data ?? []) as DefaultCategory[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing({ id: "", name: "", icon: "tag", color: "#9b87f5", is_default: true }); setForm({ name: "", icon: "tag", color: "#9b87f5" }); };
  const startEdit = (c: DefaultCategory) => { setEditing(c); setForm({ name: c.name, icon: c.icon, color: c.color }); };

  const save = async () => {
    if (!editing) return;
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    try {
      if (editing.id) {
        const { error } = await supabase.from("categories")
          .update({ name: form.name, icon: form.icon, color: form.color })
          .eq("id", editing.id);
        if (error) throw error;
        await (supabase.rpc as any)("admin_log_action", { _action: "default_category_updated", _metadata: { id: editing.id, ...form } });
      } else {
        const { error } = await supabase.from("categories")
          .insert({ name: form.name, icon: form.icon, color: form.color, is_default: true, user_id: null as any });
        if (error) throw error;
        await (supabase.rpc as any)("admin_log_action", { _action: "default_category_created", _metadata: form });
      }
      toast.success("Guardado"); setEditing(null); load();
    } catch (e: any) { toast.error("Erro", { description: e.message }); }
  };

  const remove = async (c: DefaultCategory) => {
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast.error("Erro", { description: error.message });
    else {
      await (supabase.rpc as any)("admin_log_action", { _action: "default_category_deleted", _metadata: { id: c.id, name: c.name } });
      toast.success("Categoria eliminada"); load();
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><Tag className="h-5 w-5" /> Categorias por defeito</h2>
          <Button onClick={startNew}><Plus className="mr-1.5 h-4 w-4" /> Nova</Button>
        </div>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {cats.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-6 w-6 rounded-md shrink-0" style={{ background: c.color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.icon}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirm(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{editing?.id ? "Editar categoria" : "Nova categoria"}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ícone (lucide)</Label>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="tag" />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar “{confirm?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta categoria deixará de estar disponível para todos os utilizadores.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (confirm) await remove(confirm); setConfirm(null); }}
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ────── Audit ────── */
function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("id,actor_email,action,target_email,metadata,created_at")
        .order("created_at", { ascending: false }).limit(200);
      if (error) toast.error("Erro", { description: error.message });
      else setEntries((data ?? []) as AuditEntry[]);
      setLoading(false);
    })();
  }, []);

  return (
    <section className="rounded-3xl bg-card p-6 shadow-card">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><History className="h-5 w-5" /> Últimas 200 ações</h2>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      : entries.length === 0 ? <p className="text-sm text-muted-foreground">Sem registos.</p>
      : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Alvo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</TableCell>
                  <TableCell className="text-sm">{e.actor_email ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{e.action}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.target_email ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

/* ────── Generic ────── */
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card border">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        {icon}{label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
