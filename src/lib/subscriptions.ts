import { addMonths, addYears, getDaysInMonth, isBefore, setDate, startOfDay } from "date-fns";

export type BillingCycle = "monthly" | "yearly";
export type SubStatus = "active" | "cancelled";

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  category_id: string | null;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  billing_day: number;
  next_billing_date: string; // ISO date
  status: SubStatus;
  last_used_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
}

/** Compute next billing date from a billing day and cycle. */
export function computeNextBilling(billingDay: number, cycle: BillingCycle, from: Date = new Date()): Date {
  const today = startOfDay(from);
  const daysThisMonth = getDaysInMonth(today);
  const safeDay = Math.min(billingDay, daysThisMonth);
  let candidate = setDate(today, safeDay);

  if (isBefore(candidate, today) || candidate.getTime() === today.getTime()) {
    if (cycle === "monthly") {
      const next = addMonths(today, 1);
      candidate = setDate(next, Math.min(billingDay, getDaysInMonth(next)));
    } else {
      const next = addYears(today, 1);
      candidate = setDate(next, Math.min(billingDay, getDaysInMonth(next)));
    }
  }
  return candidate;
}

export function monthlyEquivalent(sub: Pick<Subscription, "amount" | "billing_cycle">): number {
  return sub.billing_cycle === "monthly" ? sub.amount : sub.amount / 12;
}

export function yearlyEquivalent(sub: Pick<Subscription, "amount" | "billing_cycle">): number {
  return sub.billing_cycle === "monthly" ? sub.amount * 12 : sub.amount;
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(amount);
}

/** Days until billing date (negative = past). */
export function daysUntil(dateIso: string): number {
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(new Date(dateIso)).getTime();
  return Math.round((target - today) / 86400000);
}
