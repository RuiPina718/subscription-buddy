import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
  tool_calls: z.any().optional(),
});

const chatInputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
});

interface SubscriptionRow {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  billing_day: number;
  next_billing_date: string;
  status: "active" | "cancelled";
  last_used_at: string | null;
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

  const lines: string[] = [];
  lines.push(`Total: ${subs.length} (${active.length} ativas, ${subs.length - active.length} canceladas).`);
  lines.push(`Gasto mensal: €${monthly.toFixed(2)} | anual: €${yearly.toFixed(2)}.`);
  lines.push("");
  lines.push("Subscrições (id | nome | categoria | valor | ciclo | próxima | estado | última utilização):");
  for (const s of subs) {
    lines.push(
      `- ${s.id} | ${s.name} | ${s.category ?? "—"} | ${s.amount} ${s.currency} | ${s.billing_cycle} | ${s.next_billing_date} | ${s.status} | ${s.last_used_at ?? "nunca"}`,
    );
  }
  return lines.join("\n");
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_cancellation",
      description: "Propõe o cancelamento de uma subscrição. NÃO cancela imediatamente — devolve os detalhes para o utilizador confirmar num diálogo na UI. Usa SEMPRE esta ferramenta quando o utilizador pedir para cancelar algo.",
      parameters: {
        type: "object",
        properties: {
          subscription_id: { type: "string", description: "UUID da subscrição" },
        },
        required: ["subscription_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_as_used",
      description: "Marca uma subscrição como usada hoje (atualiza last_used_at para a data atual).",
      parameters: {
        type: "object",
        properties: {
          subscription_id: { type: "string", description: "UUID da subscrição" },
        },
        required: ["subscription_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_cuts",
      description: "Analisa as subscrições e devolve sugestões de cortes (não usadas há muito tempo, mais caras, duplicadas).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

function suggestCuts(subs: SubscriptionRow[]) {
  const active = subs.filter((s) => s.status === "active");
  const today = new Date();
  const suggestions: Array<{ id: string; name: string; reason: string; monthly_saving: number }> = [];

  for (const s of active) {
    const monthly = s.billing_cycle === "yearly" ? s.amount / 12 : s.amount;
    const reasons: string[] = [];

    if (!s.last_used_at) {
      reasons.push("nunca foi marcada como usada");
    } else {
      const days = Math.floor((today.getTime() - new Date(s.last_used_at).getTime()) / 86400000);
      if (days > 60) reasons.push(`não é usada há ${days} dias`);
    }
    if (monthly > 15) reasons.push(`gasto elevado (€${monthly.toFixed(2)}/mês)`);

    if (reasons.length > 0) {
      suggestions.push({
        id: s.id,
        name: s.name,
        reason: reasons.join("; "),
        monthly_saving: Number(monthly.toFixed(2)),
      });
    }
  }

  // Duplicados por categoria
  const byCat: Record<string, SubscriptionRow[]> = {};
  for (const s of active) {
    const c = s.category ?? "Sem categoria";
    (byCat[c] ??= []).push(s);
  }
  const duplicates = Object.entries(byCat)
    .filter(([, list]) => list.length > 1)
    .map(([cat, list]) => ({ category: cat, items: list.map((l) => ({ id: l.id, name: l.name })) }));

  return { suggestions: suggestions.sort((a, b) => b.monthly_saving - a.monthly_saving), duplicates };
}

async function loadSubs(supabase: any, userId: string): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, name, amount, currency, billing_cycle, billing_day, next_billing_date, status, last_used_at, notes, categories(name)")
    .eq("user_id", userId)
    .order("next_billing_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    amount: Number(s.amount),
    currency: s.currency,
    billing_cycle: s.billing_cycle,
    billing_day: s.billing_day,
    next_billing_date: s.next_billing_date,
    status: s.status,
    last_used_at: s.last_used_at,
    notes: s.notes,
    category: s.categories?.name ?? null,
  }));
}

export interface PendingCancellation {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  next_billing_date: string;
  category: string | null;
}

async function executeTool(
  name: string,
  args: any,
  supabase: any,
  userId: string,
  subs: SubscriptionRow[],
): Promise<{ result: any; mutated: boolean; pending?: PendingCancellation }> {
  if (name === "propose_cancellation") {
    const sub = subs.find((s) => s.id === args.subscription_id);
    if (!sub) return { result: { ok: false, error: "Subscrição não encontrada." }, mutated: false };
    if (sub.status === "cancelled") return { result: { ok: false, error: "Esta subscrição já está cancelada." }, mutated: false };
    const pending: PendingCancellation = {
      id: sub.id,
      name: sub.name,
      amount: sub.amount,
      currency: sub.currency,
      billing_cycle: sub.billing_cycle,
      next_billing_date: sub.next_billing_date,
      category: sub.category,
    };
    return {
      result: {
        ok: true,
        awaiting_user_confirmation: true,
        message: `Proposta de cancelamento apresentada ao utilizador. Aguarda a confirmação dele na UI antes de prosseguir. NÃO voltes a chamar esta ferramenta.`,
        details: pending,
      },
      mutated: false,
      pending,
    };
  }
  if (name === "mark_as_used") {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("subscriptions")
      .update({ last_used_at: today })
      .eq("id", args.subscription_id)
      .eq("user_id", userId);
    if (error) return { result: { ok: false, error: error.message }, mutated: false };
    return { result: { ok: true, message: `Marcada como usada em ${today}.` }, mutated: true };
  }
  if (name === "suggest_cuts") {
    return { result: suggestCuts(subs), mutated: false };
  }
  return { result: { ok: false, error: `Ferramenta desconhecida: ${name}` }, mutated: false };
}

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chatInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    let subs: SubscriptionRow[];
    try {
      subs = await loadSubs(supabase, userId);
    } catch (e) {
      console.error("chat: failed to load subscriptions", e);
      return { reply: "", error: "Não consegui carregar as tuas subscrições.", mutated: false };
    }

    const todayISO = new Date().toISOString().slice(0, 10);
    const systemPrompt = `És o assistente do Trackify, uma app de gestão de subscrições. Respondes sempre em português de Portugal, de forma clara, direta e amigável. Usa markdown leve quando ajudar.

Tens acesso a ferramentas reais para AGIR sobre os dados do utilizador:
- cancel_subscription(subscription_id): cancela uma subscrição
- mark_as_used(subscription_id): marca como usada hoje
- suggest_cuts(): devolve análise com sugestões de cortes

REGRAS IMPORTANTES:
- Antes de cancelar algo, CONFIRMA com o utilizador (a menos que ele diga claramente "cancela X").
- Usa SEMPRE o id (UUID) exato da lista de subscrições abaixo ao chamar ferramentas.
- Para perguntas só de leitura (totais, próximas cobranças), responde diretamente sem chamar ferramentas.
- Apresenta valores em euros (€). Hoje é ${todayISO}.

Dados atuais do utilizador:
${buildContext(subs)}`;

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      return { reply: "", error: "Serviço de IA não configurado.", mutated: false };
    }

    // Conversation messages for the AI loop
    const convo: any[] = [
      { role: "system", content: systemPrompt },
      ...data.messages.map((m) => {
        const msg: any = { role: m.role, content: m.content };
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        return msg;
      }),
    ];

    let mutated = false;

    // Allow up to 4 tool-call rounds
    for (let round = 0; round < 4; round++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: convo,
          tools: TOOLS,
        }),
      });

      if (response.status === 429) return { reply: "", error: "Demasiados pedidos. Tenta novamente daqui a uns segundos.", mutated };
      if (response.status === 402) return { reply: "", error: "Créditos de IA esgotados.", mutated };
      if (!response.ok) {
        const text = await response.text();
        console.error("AI gateway error", response.status, text);
        return { reply: "", error: "O assistente está temporariamente indisponível.", mutated };
      }

      const json = await response.json();
      const choice = json.choices?.[0];
      const msg = choice?.message;
      if (!msg) return { reply: "Sem resposta.", error: null, mutated };

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return { reply: msg.content || "", error: null as string | null, mutated };
      }

      // Append the assistant message with tool calls
      convo.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      });

      // Execute each tool and append a tool message with the result
      for (const tc of toolCalls) {
        let args: any = {};
        try {
          args = typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments || "{}")
            : (tc.function.arguments ?? {});
        } catch {
          args = {};
        }
        const { result, mutated: m } = await executeTool(tc.function.name, args, supabase, userId);
        if (m) mutated = true;
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return { reply: "Não consegui concluir a operação após várias tentativas.", error: null, mutated };
  });
