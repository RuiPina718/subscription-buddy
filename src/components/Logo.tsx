import { Wallet } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const text = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${dims} rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow`}>
        <Wallet className="h-1/2 w-1/2 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <span className={`${text} font-bold tracking-tight`}>Trackify</span>
    </div>
  );
}
