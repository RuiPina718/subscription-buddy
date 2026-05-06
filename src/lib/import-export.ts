import Papa from "papaparse";
import type { Subscription, Category } from "@/lib/subscriptions";

export interface CsvRow {
  name: string;
  category: string;
  amount: string;
  currency: string;
  billing_cycle: string;
  billing_day: string;
  status: string;
  notes: string;
}

const CSV_HEADERS: (keyof CsvRow)[] = [
  "name", "category", "amount", "currency", "billing_cycle", "billing_day", "status", "notes",
];

export function exportSubscriptionsCsv(subs: Subscription[], categories: Category[]): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const rows: CsvRow[] = subs.map((s) => ({
    name: s.name,
    category: s.category_id ? catMap.get(s.category_id) ?? "" : "",
    amount: String(s.amount),
    currency: s.currency,
    billing_cycle: s.billing_cycle,
    billing_day: String(s.billing_day),
    status: s.status,
    notes: s.notes ?? "",
  }));
  return Papa.unparse({ fields: CSV_HEADERS, data: rows });
}

export function exportFullJson(subs: Subscription[], categories: Category[]): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      version: 1,
      categories: categories.map((c) => ({ name: c.name, color: c.color, icon: c.icon, is_default: c.is_default })),
      subscriptions: subs.map((s) => ({
        name: s.name,
        category_id: s.category_id,
        amount: s.amount,
        currency: s.currency,
        billing_cycle: s.billing_cycle,
        billing_day: s.billing_day,
        status: s.status,
        notes: s.notes,
        next_billing_date: s.next_billing_date,
        last_used_at: s.last_used_at,
      })),
    },
    null,
    2,
  );
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ParsedRow {
  name: string;
  categoryName: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  billing_day: number;
  status: "active" | "cancelled";
  notes: string | null;
  errors: string[];
}

export function parseCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const errors: string[] = [];
  if (result.errors.length) {
    for (const e of result.errors) errors.push(`Linha ${e.row}: ${e.message}`);
  }
  const rows: ParsedRow[] = (result.data ?? []).map((raw) => {
    const rowErrors: string[] = [];
    const get = (k: string) => (raw[k] ?? raw[k.toLowerCase()] ?? "").toString().trim();

    const name = get("name");
    if (!name) rowErrors.push("nome em falta");

    const amountRaw = get("amount").replace(",", ".");
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) rowErrors.push("valor inválido");

    const cycleRaw = get("billing_cycle").toLowerCase();
    const billing_cycle: "monthly" | "yearly" =
      cycleRaw === "yearly" || cycleRaw === "anual" || cycleRaw === "ano" ? "yearly" : "monthly";

    const dayRaw = Number(get("billing_day") || "1");
    const billing_day = Math.min(Math.max(Math.round(dayRaw) || 1, 1), 31);

    const statusRaw = get("status").toLowerCase();
    const status: "active" | "cancelled" =
      statusRaw === "cancelled" || statusRaw === "cancelada" || statusRaw === "inactive" ? "cancelled" : "active";

    return {
      name,
      categoryName: get("category"),
      amount: Number.isFinite(amount) ? amount : 0,
      currency: (get("currency") || "EUR").toUpperCase().slice(0, 3),
      billing_cycle,
      billing_day,
      status,
      notes: get("notes") || null,
      errors: rowErrors,
    };
  });
  return { rows, errors };
}
