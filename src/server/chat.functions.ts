import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const chatInputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
});

interface SubscriptionRow {
  name: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  billing_day: number;
  next_billing_date: string;
  status: "active" | "cancelled";
  notes: string | null;
  category: string | null;
}

function buildContext(subs: SubscriptionRow[]): string {
  if (subs.length === 0) return "O utilizador ainda não tem subscrições registadas.";

  const active = subs.filter((s) => s.status === "active");
  const monthly = active.reduce(
    (sum, s) => sum + (s.billing_cycle === "yearly" ? s.amount / 12 : s.amount),
    0,
  );
  const yearly = active.reduce(
    (sum, s) => sum + (s.billing_cycle === "yearly" ? s.amount : s.amount * 12),
    0,
  );

  const byCat: Record<string, { count: number; monthly: number }> = {};
  for (const s of active) {
    const cat = s.category ?? "Sem categoria";
    const m = s.billing_cycle === "yearly" ? s.amount / 12 : s.amount;
    byCat[cat] = byCat[cat] ?? { count: 0, monthly: 0 };
    byCat[cat].count += 1;
    byCat[cat].monthly += m;
  }

  const lines: string[] = [];
  lines.push(`Total de subscrições: ${subs.length} (${active.length} ativas, ${subs.length - active.length} canceladas).`);
  lines.push(`Gasto mensal estimado: €${monthly.toFixed(2)}.`);
  lines.push(`Gasto anual estimado: €${yearly.toFixed(2)}.`);
  lines.push("");
  lines.push("Por categoria (apenas ativas):");
  for (const [cat, v] of Object.entries(byCat).sort((a, b) => b[1].monthly - a[1].monthly)) {
    lines.push(`- ${cat}: ${v.count} subscrição(ões), €${v.monthly.toFixed(2)}/mês`);
  }
  lines.push("");
  lines.push("Detalhe das subscrições:");
  for (const s of subs) {
    lines.push(
      `- ${s.name} | ${s.category ?? "—"} | ${s.amount} ${s.currency} / ${s.billing_cycle === "monthly" ? "mês" : "ano"} | dia de cobrança: ${s.billing_day} | próxima: ${s.next_billing_date} | estado: ${s.status}${s.notes ? ` | notas: ${s.notes}` : ""}`,
    );
  }
  return lines.join("\n");
}

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chatInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // Fetch the user's subscriptions with category names
    const { data: subsRaw, error: subsErr } = await supabase
      .from("subscriptions")
      .select("name, amount, currency, billing_cycle, billing_day, next_billing_date, status, notes, categories(name)")
      .eq("user_id", userId)
      .order("next_billing_date", { ascending: true });

    if (subsErr) {
      console.error("chat: failed to load subscriptions", subsErr);
      return { reply: "", error: "Não consegui carregar as tuas subscrições." };
    }

    const subs: SubscriptionRow[] = (subsRaw ?? []).map((s: any) => ({
      name: s.name,
      amount: Number(s.amount),
      currency: s.currency,
      billing_cycle: s.billing_cycle,
      billing_day: s.billing_day,
      next_billing_date: s.next_billing_date,
      status: s.status,
      notes: s.notes,
      category: s.categories?.name ?? null,
    }));

    const contextBlock = buildContext(subs);
    const todayISO = new Date().toISOString().slice(0, 10);

    const systemPrompt = `És o assistente do Trackify, uma app de gestão de subscrições. Respondes sempre em português de Portugal, de forma clara, direta e amigável. Usa markdown leve quando ajudar (listas, **negrito**). Baseia as respostas APENAS nos dados do utilizador fornecidos abaixo — se não tiveres a informação, diz que não sabes. Apresenta valores monetários em euros (€). Hoje é ${todayISO}.

Dados do utilizador:
${contextBlock}`;

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      return { reply: "", error: "Serviço de IA não configurado." };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...data.messages,
        ],
      }),
    });

    if (response.status === 429) {
      return { reply: "", error: "Demasiados pedidos. Tenta novamente daqui a uns segundos." };
    }
    if (response.status === 402) {
      return { reply: "", error: "Créditos de IA esgotados. Adiciona créditos no Lovable Cloud." };
    }
    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error", response.status, text);
      return { reply: "", error: "O assistente está temporariamente indisponível." };
    }

    const json = await response.json();
    const reply: string = json.choices?.[0]?.message?.content ?? "";
    return { reply, error: null as string | null };
  });
