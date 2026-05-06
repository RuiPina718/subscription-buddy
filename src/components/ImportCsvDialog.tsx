import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCsv, type ParsedRow } from "@/lib/import-export";
import { useCategories } from "@/lib/data-hooks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { computeNextBilling } from "@/lib/subscriptions";
import { Loader2, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function ImportCsvDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { data: categories = [] } = useCategories();
  const qc = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [filename, setFilename] = useState("");

  const reset = () => {
    setRows([]);
    setParseErrors([]);
    setFilename("");
  };

  const handleFile = async (file: File) => {
    setFilename(file.name);
    const text = await file.text();
    const { rows, errors } = parseCsv(text);
    setRows(rows);
    setParseErrors(errors);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);

  const handleImport = async () => {
    if (!user || validRows.length === 0) return;
    setImporting(true);
    try {
      const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
      // Create missing categories
      const missing = Array.from(
        new Set(
          validRows
            .map((r) => r.categoryName.trim())
            .filter((n) => n && !catByName.has(n.toLowerCase())),
        ),
      );
      if (missing.length > 0) {
        const { data: created, error } = await supabase
          .from("categories")
          .insert(missing.map((name) => ({ name, color: "#9b87f5", icon: "tag", user_id: user.id, is_default: false })))
          .select("id, name");
        if (error) throw error;
        for (const c of created ?? []) catByName.set(c.name.toLowerCase(), c.id);
      }

      const payload = validRows.map((r) => {
        const next = computeNextBilling(r.billing_day, r.billing_cycle);
        return {
          user_id: user.id,
          name: r.name,
          category_id: r.categoryName ? catByName.get(r.categoryName.toLowerCase()) ?? null : null,
          amount: r.amount,
          currency: r.currency,
          billing_cycle: r.billing_cycle,
          billing_day: r.billing_day,
          status: r.status,
          notes: r.notes,
          next_billing_date: next.toISOString().slice(0, 10),
        };
      });

      // Insert in chunks of 100
      for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        const { error } = await supabase.from("subscriptions").insert(chunk);
        if (error) throw error;
      }

      toast.success(`${validRows.length} subscrições importadas`);
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error("Erro a importar", { description: e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar subscrições (CSV)</DialogTitle>
          <DialogDescription>
            Colunas esperadas: <code>name, category, amount, currency, billing_cycle, billing_day, status, notes</code>.
            Categorias inexistentes são criadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center transition-base hover:bg-muted/50">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Clica para escolher um ficheiro CSV</p>
            <p className="text-xs text-muted-foreground">ou arrasta para aqui</p>
            <Input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{filename}</span>
              <button onClick={reset} className="text-xs text-muted-foreground hover:underline">
                Escolher outro
              </button>
            </div>

            {parseErrors.length > 0 && (
              <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                <p className="font-semibold">Avisos do parser:</p>
                <ul className="mt-1 list-disc pl-5">
                  {parseErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card max-h-[300px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="p-2">Nome</th>
                    <th className="p-2">Categoria</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2">Ciclo</th>
                    <th className="p-2 text-right">Dia</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-t border-border ${r.errors.length ? "bg-destructive/5" : ""}`}>
                      <td className="p-2 font-medium">
                        {r.errors.length > 0 && <AlertCircle className="mr-1 inline h-3 w-3 text-destructive" />}
                        {r.name || <span className="text-destructive">(vazio)</span>}
                      </td>
                      <td className="p-2 text-muted-foreground">{r.categoryName || "—"}</td>
                      <td className="p-2 text-right">{r.amount.toFixed(2)} {r.currency}</td>
                      <td className="p-2">{r.billing_cycle === "monthly" ? "mensal" : "anual"}</td>
                      <td className="p-2 text-right">{r.billing_day}</td>
                      <td className="p-2">{r.status === "active" ? "ativa" : "cancelada"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              {validRows.length} de {rows.length} linhas válidas.
              {rows.length - validRows.length > 0 && ` ${rows.length - validRows.length} serão ignoradas.`}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="bg-gradient-primary text-primary-foreground"
          >
            {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            Importar {validRows.length > 0 && `(${validRows.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
