import { supabase } from "@/integrations/supabase/client";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export async function loadOrCreateConversation(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function loadMessages(conversationId: string): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoredMessage[];
}

export async function appendMessage(
  conversationId: string,
  userId: string,
  role: "user" | "assistant",
  content: string,
) {
  await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
  });
  await supabase
    .from("chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function clearConversation(conversationId: string) {
  await supabase.from("chat_messages").delete().eq("conversation_id", conversationId);
}
