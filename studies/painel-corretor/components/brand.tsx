import type { Operadora } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Marca neutra do projeto de estudo. Não usa nome nem logotipo do serviço de referência. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground dark:bg-white dark:text-slate-900">
        PM
      </div>
      <div className="leading-tight">
        <div className="text-base font-extrabold tracking-tight text-primary dark:text-white">Painel</div>
        <div className="-mt-1 text-[11px] font-medium text-muted-foreground">multicálculo · estudo</div>
      </div>
    </div>
  );
}

/** "Logotipo" tipográfico das operadoras fictícias. */
export function OperadoraLogo({ op, className }: { op: Operadora; className?: string }) {
  return (
    <span
      className={cn("font-black lowercase tracking-tight dark:contrast-50", className)}
      style={{ color: op.cor }}
    >
      {op.nome}
    </span>
  );
}
