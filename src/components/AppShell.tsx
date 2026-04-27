import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ListChecks, CalendarDays, Lightbulb, Settings, LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subscriptions", label: "Subscrições", icon: ListChecks },
  { to: "/calendar", label: "Calendário", icon: CalendarDays },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/settings", label: "Definições", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-base",
              active
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-foreground/70 hover:bg-secondary hover:text-foreground"
            )}
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard"><Logo size="sm" /></Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-5 border-r border-border/60 bg-sidebar p-5 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}>
          <Link to="/dashboard" onClick={() => setOpen(false)} className="hidden md:block"><Logo /></Link>
          <NavLinks onClick={() => setOpen(false)} />
          <div className="border-t border-border pt-4">
            <div className="mb-3 px-2">
              <p className="truncate text-xs text-muted-foreground">Sessão iniciada</p>
              <p className="truncate text-sm font-medium">{user?.email}</p>
            </div>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Terminar sessão
            </Button>
          </div>
        </aside>

        {/* Backdrop */}
        {open && <div className="fixed inset-0 z-30 bg-foreground/30 md:hidden" onClick={() => setOpen(false)} />}

        {/* Main */}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
