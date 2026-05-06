import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface CategoryBudget {
  id: string;
  user_id: string;
  category_id: string;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
}

export function useBudgets() {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["budgets", user?.id],
    queryFn: async (): Promise<CategoryBudget[]> => {
      const { data, error } = await supabase.from("category_budgets").select("*");
      if (error) throw error;
      return (data ?? []) as CategoryBudget[];
    },
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ category_id, monthly_limit }: { category_id: string; monthly_limit: number }) => {
      if (!user) throw new Error("Sem sessão");
      const { error } = await supabase
        .from("category_budgets")
        .upsert(
          { user_id: user.id, category_id, monthly_limit },
          { onConflict: "user_id,category_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("category_budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}
