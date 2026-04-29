import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Subscription, Category } from "./subscriptions";
import { computeNextBilling, type BillingCycle } from "./subscriptions";

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["categories", user?.id],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useSubscriptions() {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["subscriptions", user?.id],
    queryFn: async (): Promise<Subscription[]> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("next_billing_date");
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
  });
}

export interface SubscriptionInput {
  name: string;
  category_id: string | null;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  billing_day: number;
  notes?: string | null;
}

export function useUpsertSubscription() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SubscriptionInput }) => {
      if (!user) throw new Error("Sem sessão");
      const next = computeNextBilling(input.billing_day, input.billing_cycle);
      const payload = {
        ...input,
        user_id: user.id,
        next_billing_date: next.toISOString().slice(0, 10),
      };
      if (id) {
        const { error } = await supabase.from("subscriptions").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscriptions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}

export function useToggleSubscriptionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "cancelled" }) => {
      const { error } = await supabase.from("subscriptions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}

export function useUpdateCategoryColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const { error } = await supabase.from("categories").update({ color }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; color: string; icon: string }) => {
      if (!user) throw new Error("Sem sessão");
      const { error } = await supabase.from("categories").insert({
        ...input, user_id: user.id, is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
