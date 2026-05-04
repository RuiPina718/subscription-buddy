import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { confirmSubscriptionCancellation, runAssistantChat } from "./chat.server";

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

const confirmInputSchema = z.object({ subscription_id: z.string().uuid() });

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chatInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context as { supabase: any; userId: string };
      return await runAssistantChat({ messages: data.messages, supabase, userId });
    } catch (e: any) {
      console.error("chatWithAssistant unhandled", e?.message, e?.stack);
      return {
        reply: "",
        error: `Erro interno: ${e?.message ?? "desconhecido"}`,
        mutated: false,
        pendingCancellation: null,
      };
    }
  });

export const confirmCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => confirmInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    return confirmSubscriptionCancellation({
      supabase,
      userId,
      subscriptionId: data.subscription_id,
    });
  });