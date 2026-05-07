import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { chatWithAssistant, confirmCancellation } from "@/server/chat.functions";
import { useAuth } from "@/lib/auth";
import {
  loadOrCreateConversation,
  loadMessages,
  appendMessage,
  clearConversation,
} from "@/lib/chat-history";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bot, Send, X, Loader2, Sparkles, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/subscriptions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PendingCancellation {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  next_billing_date: string;
  category: string | null;
}

const SUGGESTIONS = [
  "Quanto gasto por mês?",
  "Sugere-me cortes para poupar",
  "Marca a Netflix como usada hoje",
];

export function ChatWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingCancellation | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirming, setConfirming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(chatWithAssistant);
  const confirmFn = useServerFn(confirmCancellation);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Load history when first opened
  useEffect(() => {
    if (!open || !user || conversationId) return;
    (async () => {
      try {
        const cid = await loadOrCreateConversation(user.id);
        setConversationId(cid);
        const stored = await loadMessages(cid);
        if (stored.length > 0) {
          setMessages(stored.map((m) => ({ role: m.role, content: m.content })));
        }
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    })();
  }, [open, user, conversationId]);

  if (!user) return null;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    let cid = conversationId;
    if (!cid) {
      try {
        cid = await loadOrCreateConversation(user.id);
        setConversationId(cid);
      } catch (e) {
        console.error("conversation create failed", e);
      }
    }
    if (cid) appendMessage(cid, user.id, "user", trimmed).catch(console.error);

    try {
      const res = await chat({ data: { messages: next } });
      if (res.mutated) {
        qc.invalidateQueries({ queryKey: ["subscriptions"] });
        qc.invalidateQueries({ queryKey: ["budgets"] });
        toast.success("Atualizações aplicadas");
      }
      if (res.pendingCancellation) {
        setPending(res.pendingCancellation);
        setConfirmStep(1);
      }
      const replyContent = res.error
        ? `⚠️ ${res.error}`
        : res.reply?.trim() || "Não consegui gerar uma resposta completa desta vez. Tenta reformular o pedido.";
      setMessages([...next, { role: "assistant", content: replyContent }]);
      if (cid) appendMessage(cid, user.id, "assistant", replyContent).catch(console.error);
    } catch (e: any) {
      const err = `⚠️ ${e?.message ?? "Erro inesperado."}`;
      setMessages([...next, { role: "assistant", content: err }]);
      if (cid) appendMessage(cid, user.id, "assistant", err).catch(console.error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      await clearConversation(conversationId);
      setMessages([]);
      toast.success("Histórico limpo");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível limpar");
    }
  };

  const handleConfirmCancel = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      const res = await confirmFn({ data: { subscription_id: pending.id } });
      if (res.ok) {
        toast.success(`${pending.name} cancelada`);
        qc.invalidateQueries({ queryKey: ["subscriptions"] });
        const msg = `✅ Cancelei a subscrição **${pending.name}**.`;
        setMessages((m) => [...m, { role: "assistant", content: msg }]);
        if (conversationId) appendMessage(conversationId, user.id, "assistant", msg).catch(console.error);
        setPending(null);
        setConfirmStep(1);
      } else {
        toast.error(res.error || "Não foi possível cancelar");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar");
    } finally {
      setConfirming(false);
    }
  };

  const handleAbort = () => {
    setMessages((m) => [
      ...m,
      { role: "assistant", content: "Ok, cancelamento abortado. Não fiz nenhuma alteração." },
    ]);
    setPending(null);
    setConfirmStep(1);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition-base hover:scale-105 active:scale-95"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className={cn(
          "fixed z-50 flex flex-col rounded-3xl border border-border bg-card shadow-2xl",
          "bottom-4 right-4 left-4 h-[80vh] max-h-[640px]",
          "sm:left-auto sm:bottom-5 sm:right-5 sm:w-[400px] sm:h-[560px]"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-3xl border-b border-border bg-gradient-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div>
                <p className="text-sm font-bold leading-tight">Assistente Trackify</p>
                <p className="text-xs opacity-90 leading-tight">Pergunta sobre as tuas subscrições</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  aria-label="Limpar histórico"
                  className="rounded-full p-1.5 transition-base hover:bg-white/20"
                  title="Limpar histórico"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-full p-1.5 transition-base hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Olá! Posso ajudar-te a perceber os teus gastos com subscrições. Experimenta:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium transition-base hover:bg-secondary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-secondary-foreground rounded-bl-md"
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 dark:prose-invert">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreve a tua pergunta…"
              disabled={loading}
              className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none transition-base focus:border-primary"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} className="rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Step-by-step cancellation confirmation */}
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o && !confirming) handleAbort(); }}>
        <AlertDialogContent>
          {pending && confirmStep === 1 && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Confirmar cancelamento (1 de 2)
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 pt-2">
                    <p>Vais cancelar a seguinte subscrição. Verifica os detalhes:</p>
                    <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Nome</span>
                        <span className="font-semibold text-foreground">{pending.name}</span>
                      </div>
                      {pending.category && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Categoria</span>
                          <span className="text-foreground">{pending.category}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Valor</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(pending.amount, pending.currency)}{" "}
                          <span className="text-xs text-muted-foreground">
                            / {pending.billing_cycle === "monthly" ? "mês" : "ano"}
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Próxima cobrança</span>
                        <span className="font-semibold text-foreground">
                          {format(new Date(pending.next_billing_date), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                        </span>
                      </div>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleAbort}>Não, manter</AlertDialogCancel>
                <AlertDialogAction onClick={() => setConfirmStep(2)}>
                  Continuar
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {pending && confirmStep === 2 && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Última confirmação (2 de 2)
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 pt-2 text-sm">
                    <p>
                      Tens a certeza que queres cancelar{" "}
                      <span className="font-semibold text-foreground">{pending.name}</span>?
                    </p>
                    <p className="text-muted-foreground">
                      Esta ação muda o estado para "cancelada". Podes reativá-la mais tarde a partir
                      da página de subscrições.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmStep(1)} disabled={confirming}>
                  Voltar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmCancel}
                  disabled={confirming}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A cancelar…
                    </>
                  ) : (
                    "Sim, cancelar"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
