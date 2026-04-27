import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSubscriptions, useCategories } from "@/lib/data-hooks";
import { formatCurrency } from "@/lib/subscriptions";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDate, getDaysInMonth, isSameDay, isSameMonth, startOfMonth, subMonths } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendário — Trackify" }] }),
});

function CalendarPage() {
  const { data: subs = [] } = useSubscriptions();
  const { data: categories = [] } = useCategories();
  const [cursor, setCursor] = useState(startOfMonth(new Date()));

  const active = subs.filter((s) => s.status === "active");

  // Build all billing occurrences within visible month for monthly subs (every month) and yearly (only if month matches creation/next)
  const billingsByDay = useMemo(() => {
    const map = new Map<number, { sub: typeof active[number]; categoryColor: string }[]>();
    const monthDays = getDaysInMonth(cursor);
    for (const s of active) {
      const cat = categories.find((c) => c.id === s.category_id);
      const color = cat?.color ?? "#94A3B8";
      const next = new Date(s.next_billing_date);
      if (s.billing_cycle === "monthly") {
        const day = Math.min(s.billing_day, monthDays);
        const arr = map.get(day) ?? []; arr.push({ sub: s, categoryColor: color }); map.set(day, arr);
      } else {
        if (next.getMonth() === cursor.getMonth() && next.getFullYear() === cursor.getFullYear()) {
          const day = next.getDate();
          const arr = map.get(day) ?? []; arr.push({ sub: s, categoryColor: color }); map.set(day, arr);
        }
      }
    }
    return map;
  }, [active, categories, cursor]);

  const monthTotal = useMemo(() => {
    let total = 0;
    billingsByDay.forEach((arr) => arr.forEach(({ sub }) => { total += Number(sub.amount); }));
    return total;
  }, [billingsByDay]);

  const days = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const firstDayOfWeek = (startOfMonth(cursor).getDay() + 6) % 7; // Mon=0
  const today = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Calendário</h1>
        <p className="mt-1 text-muted-foreground">Vê todas as cobranças mês a mês.</p>
      </div>

      <div className="rounded-3xl bg-card p-5 shadow-card md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="min-w-[160px] text-center text-xl font-bold capitalize">
              {format(cursor, "MMMM yyyy", { locale: pt })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total do mês</p>
            <p className="text-lg font-bold">{formatCurrency(monthTotal)}</p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted-foreground">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((day) => {
            const items = billingsByDay.get(getDate(day)) ?? [];
            const isToday = isSameDay(day, today) && isSameMonth(day, cursor);
            return (
              <div key={day.toISOString()} className={cn(
                "aspect-square rounded-xl border border-border/60 bg-background/50 p-1.5 flex flex-col text-left transition-base",
                isToday && "ring-2 ring-primary"
              )}>
                <span className={cn("text-xs font-semibold", isToday && "text-primary")}>{getDate(day)}</span>
                <div className="mt-auto flex flex-wrap gap-1">
                  {items.slice(0, 3).map(({ sub, categoryColor }) => (
                    <span key={sub.id}
                      title={`${sub.name} — ${formatCurrency(Number(sub.amount), sub.currency)}`}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: categoryColor }} />
                  ))}
                  {items.length > 3 && <span className="text-[10px] font-bold text-muted-foreground">+{items.length - 3}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* List of upcoming this month */}
      <div className="rounded-3xl bg-card p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold">Cobranças neste mês</h2>
        {Array.from(billingsByDay.entries()).sort((a, b) => a[0] - b[0]).flatMap(([day, items]) =>
          items.map(({ sub, categoryColor }) => (
            <div key={`${day}-${sub.id}`} className="flex items-center justify-between border-b border-border/40 py-3 last:border-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white"
                     style={{ background: categoryColor }}>
                  {String(day).padStart(2, "0")}
                </div>
                <div>
                  <p className="font-semibold leading-tight">{sub.name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(cursor.getFullYear(), cursor.getMonth(), day), "EEEE", { locale: pt })}</p>
                </div>
              </div>
              <span className="font-bold">{formatCurrency(Number(sub.amount), sub.currency)}</span>
            </div>
          ))
        )}
        {billingsByDay.size === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem cobranças este mês 🎉</p>
        )}
      </div>
    </div>
  );
}
