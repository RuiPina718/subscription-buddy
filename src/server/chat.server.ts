export interface ChatMessageInput {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: unknown;
}

export interface SubscriptionRow {
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

export interface PendingCancellation {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  next_billing_date: string;
  category: string | null;
}

export interface AssistantResult {
  reply: string;
  error: string | null;
  mutated: boolean;
  pendingCancellation: PendingCancellation | null;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_cancellation",
      description:
        "Propõe o cancelamento de uma subscrição. NÃO cancela imediatamente — devolve os detalhes para o utilizador confirmar num diálogo na UI. Usa SEMPRE esta ferramenta quando o utilizador pedir para cancelar algo.",
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
      description:
        "Analisa as subscrições e devolve sugestões de cortes (não usadas há muito tempo, mais caras, duplicadas).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_subscription",
      description: "Cria uma nova subscrição para o utilizador. Confirma o nome, valor e ciclo antes de chamar.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string", description: "Código ISO, default EUR" },
          billing_cycle: { type: "string", enum: ["monthly", "yearly"] },
          billing_day: { type: "number", description: "Dia do mês (1-28) em que é cobrada" },
          category: { type: "string", description: "Nome da categoria existente (opcional)" },
        },
        required: ["name", "amount", "billing_cycle", "billing_day"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_subscription_amount",
      description: "Atualiza o valor (preço) de uma subscrição existente.",
      parameters: {
        type: "object",
        properties: {
          subscription_id: { type: "string" },
          amount: { type: "number" },
        },
        required: ["subscription_id", "amount"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_months",
      description: "Compara o gasto mensal atual com a média histórica e devolve diferença.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "set_budget",
      description: "Define ou atualiza um orçamento mensal para uma categoria.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Nome da categoria" },
          monthly_limit: { type: "number" },
        },
        required: ["category", "monthly_limit"],
        additionalProperties: false,
      },
    },
  },
];

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
        message: "Proposta de cancelamento apresentada ao utilizador. Aguarda a confirmação dele na UI antes de prosseguir.",
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
  if (name === "create_subscription") {
    const { name: subName, amount, currency, billing_cycle, billing_day, category } = args;
    if (!subName || typeof amount !== "number" || !billing_cycle || !billing_day) {
      return { result: { ok: false, error: "Faltam campos obrigatórios." }, mutated: false };
    }
    let category_id: string | null = null;
    if (category) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .or(`user_id.eq.${userId},is_default.eq.true`)
        .ilike("name", category)
        .maybeSingle();
      category_id = cat?.id ?? null;
    }
    const today = new Date();
    const day = Math.min(Math.max(1, Number(billing_day)), 28);
    const next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next <= today) next.setMonth(next.getMonth() + 1);
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        name: subName,
        amount,
        currency: currency || "EUR",
        billing_cycle,
        billing_day: day,
        next_billing_date: next.toISOString().slice(0, 10),
        category_id,
        status: "active",
      })
      .select("id")
      .single();
    if (error) return { result: { ok: false, error: error.message }, mutated: false };
    return { result: { ok: true, id: data.id, message: `Subscrição "${subName}" criada.` }, mutated: true };
  }
  if (name === "update_subscription_amount") {
    const { error } = await supabase
      .from("subscriptions")
      .update({ amount: args.amount })
      .eq("id", args.subscription_id)
      .eq("user_id", userId);
    if (error) return { result: { ok: false, error: error.message }, mutated: false };
    return { result: { ok: true, message: `Valor atualizado para €${args.amount}.` }, mutated: true };
  }
  if (name === "compare_months") {
    const active = subs.filter((s) => s.status === "active");
    const currentMonthly = active.reduce((sum, s) => sum + (s.billing_cycle === "yearly" ? s.amount / 12 : s.amount), 0);
    const allMonthly = subs.reduce((sum, s) => sum + (s.billing_cycle === "yearly" ? s.amount / 12 : s.amount), 0);
    const cancelled = subs.filter((s) => s.status === "cancelled");
    const savedMonthly = cancelled.reduce((sum, s) => sum + (s.billing_cycle === "yearly" ? s.amount / 12 : s.amount), 0);
    return {
      result: {
        current_monthly: Number(currentMonthly.toFixed(2)),
        with_cancelled_monthly: Number(allMonthly.toFixed(2)),
        saved_per_month: Number(savedMonthly.toFixed(2)),
        active_count: active.length,
        cancelled_count: cancelled.length,
      },
      mutated: false,
    };
  }
  if (name === "set_budget") {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .or(`user_id.eq.${userId},is_default.eq.true`)
      .ilike("name", args.category)
      .maybeSingle();
    if (!cat) return { result: { ok: false, error: `Categoria "${args.category}" não encontrada.` }, mutated: false };
    const { error } = await supabase
      .from("category_budgets")
      .upsert(
        { user_id: userId, category_id: cat.id, monthly_limit: args.monthly_limit },
        { onConflict: "user_id,category_id" },
      );
    if (error) return { result: { ok: false, error: error.message }, mutated: false };
    return { result: { ok: true, message: `Orçamento de ${args.category} definido em €${args.monthly_limit}/mês.` }, mutated: true };
  }
  return { result: { ok: false, error: `Ferramenta desconhecida: ${name}` }, mutated: false };
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function toolFallbackReply(toolName: string, result: any, pending?: PendingCancellation): string {
  if (pending) {
    return `Abri o diálogo de confirmação para cancelares **${pending.name}**. Confirma os detalhes antes de avançar.`;
  }
  if (toolName === "mark_as_used" && result?.ok) return "✅ Marquei essa subscrição como usada hoje.";
  if (toolName === "mark_as_used" && result?.error) return `Não consegui marcar como usada: ${result.error}`;
  if (toolName === "suggest_cuts") {
    const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
    const duplicates = Array.isArray(result?.duplicates) ? result.duplicates : [];
    if (suggestions.length === 0 && duplicates.length === 0) return "Não encontrei cortes óbvios com base nos teus dados atuais.";
    const lines = ["Estas são as melhores oportunidades de poupança:"];
    for (const item of suggestions.slice(0, 5)) {
      lines.push(`- **${item.name}**: ${item.reason} — poupança estimada de €${Number(item.monthly_saving).toFixed(2)}/mês.`);
    }
    for (const group of duplicates) {
      const names = Array.isArray(group.items) ? group.items.map((i: any) => i.name).join(", ") : "";
      lines.push(`- Tens várias subscrições em **${group.category}**: ${names}.`);
    }
    return lines.join("\n");
  }
  return "Já tratei do pedido. Se quiseres, posso ajudar com outra subscrição.";
}

function genericFallbackReply(subs: SubscriptionRow[], userText: string): string {
  const active = subs.filter((s) => s.status === "active");
  const monthly = active.reduce((sum, s) => sum + (s.billing_cycle === "yearly" ? s.amount / 12 : s.amount), 0);
  const yearly = active.reduce((sum, s) => sum + (s.billing_cycle === "yearly" ? s.amount : s.amount * 12), 0);
  if (/quanto|gasto|total|m[eê]s|mensal/i.test(userText)) {
    return `Neste momento gastas cerca de **€${monthly.toFixed(2)}/mês** em subscrições ativas, ou **€${yearly.toFixed(2)}/ano**.`;
  }
  if (subs.length === 0) return "Ainda não tens subscrições registadas. Adiciona a primeira subscrição e depois posso ajudar-te a analisá-la.";
  return "Não consegui gerar uma resposta completa desta vez. Tenta reformular o pedido ou diz-me o nome da subscrição que queres analisar.";
}

export async function runAssistantChat({
  messages,
  supabase,
  userId,
}: {
  messages: ChatMessageInput[];
  supabase: any;
  userId: string;
}): Promise<AssistantResult> {
  let subs: SubscriptionRow[];
  try {
    subs = await loadSubs(supabase, userId);
  } catch (e) {
    console.error("chat: failed to load subscriptions", e);
    return { reply: "", error: "Não consegui carregar as tuas subscrições.", mutated: false, pendingCancellation: null };
  }

  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) {
    return { reply: "", error: "Serviço de IA não configurado.", mutated: false, pendingCancellation: null };
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const systemPrompt = `És o assistente do Trackify, uma app de gestão de subscrições. Respondes sempre em português de Portugal, de forma clara, direta e amigável. Usa markdown leve quando ajudar.

Tens acesso a ferramentas para AGIR sobre os dados do utilizador:
- propose_cancellation(subscription_id): propõe cancelar uma subscrição. NÃO cancela imediatamente — abre um diálogo na UI onde o utilizador confirma passo-a-passo. Usa SEMPRE esta ferramenta quando o utilizador pedir para cancelar.
- mark_as_used(subscription_id): marca como usada hoje.
- suggest_cuts(): devolve análise com sugestões de cortes.

REGRAS IMPORTANTES:
- NUNCA prometas que cancelaste algo. Após chamar propose_cancellation, diz que abriste o diálogo de confirmação.
- Usa SEMPRE o id (UUID) exato da lista de subscrições abaixo ao chamar ferramentas.
- Para perguntas só de leitura (totais, próximas cobranças), responde diretamente sem chamar ferramentas.
- Apresenta valores em euros (€). Hoje é ${todayISO}.

Dados atuais do utilizador:
${buildContext(subs)}`;

  const convo: any[] = [
    { role: "system", content: systemPrompt },
    ...messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  let mutated = false;
  let pendingCancellation: PendingCancellation | null = null;
  let lastToolReply = "";
  const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  for (let round = 0; round < 4; round++) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: convo,
        tools: TOOLS,
        max_tokens: 900,
      }),
    });

    if (response.status === 429) return { reply: "", error: "Demasiados pedidos. Tenta novamente daqui a uns segundos.", mutated, pendingCancellation };
    if (response.status === 402) return { reply: "", error: "Créditos de IA esgotados.", mutated, pendingCancellation };
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("AI gateway error", response.status, text);
      return { reply: "", error: `O assistente está indisponível (${response.status}).`, mutated, pendingCancellation };
    }

    const json = await response.json();
    const choice = json.choices?.[0];
    const msg = choice?.message;
    if (!msg) {
      console.error("AI gateway empty message", JSON.stringify({ finish_reason: choice?.finish_reason, usage: json.usage }));
      return { reply: lastToolReply || genericFallbackReply(subs, lastUserText), error: null, mutated, pendingCancellation };
    }

    const text = messageContentToText(msg.content);
    const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (toolCalls.length === 0) {
      return { reply: text || lastToolReply || genericFallbackReply(subs, lastUserText), error: null, mutated, pendingCancellation };
    }

    convo.push({ role: "assistant", content: text, tool_calls: toolCalls });

    for (const tc of toolCalls) {
      let args: any = {};
      try {
        args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments || "{}") : (tc.function?.arguments ?? {});
      } catch {
        args = {};
      }
      const toolName = String(tc.function?.name ?? "");
      const { result, mutated: didMutate, pending } = await executeTool(toolName, args, supabase, userId, subs);
      if (didMutate) mutated = true;
      if (pending) pendingCancellation = pending;
      lastToolReply = toolFallbackReply(toolName, result, pending);
      convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }

  return { reply: lastToolReply || genericFallbackReply(subs, lastUserText), error: null, mutated, pendingCancellation };
}

export async function confirmSubscriptionCancellation({
  supabase,
  userId,
  subscriptionId,
}: {
  supabase: any;
  userId: string;
  subscriptionId: string;
}) {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}