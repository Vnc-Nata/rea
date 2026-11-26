import type { Operadora, Plano } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Marca do app. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground dark:bg-white dark:text-slate-900">
        AP
      </div>
      <div className="leading-tight">
        <div className="text-base font-extrabold tracking-tight text-primary dark:text-white">Atan Prime</div>
        <div className="-mt-1 text-[11px] font-medium text-muted-foreground">Cotações</div>
      </div>
    </div>
  );
}

/** Ícone da operadora: logo em public/logos quando existe, senão selo redondo com a sigla na cor dela. */
export function OperadoraIcone({
  op,
  tamanho = 32,
  className,
}: {
  op: Operadora;
  tamanho?: number;
  className?: string;
}) {
  const estilo = { width: tamanho, height: tamanho };
  if (op.logo)
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={op.logo}
        alt=""
        width={tamanho}
        height={tamanho}
        style={estilo}
        className={cn("shrink-0 rounded-full bg-white object-contain", className)}
      />
    );
  return (
    <span
      aria-hidden
      data-sigla={op.sigla}
      style={{ ...estilo, backgroundColor: op.cor, fontSize: Math.round(tamanho * 0.4) }}
      className={cn("grid shrink-0 place-items-center rounded-full font-bold leading-none text-white", className)}
    >
      {op.sigla}
    </span>
  );
}

/** Ícone + nome da operadora (nome na cor dela). `className` vale para o nome. */
export function OperadoraLogo({ op, className, tamanho }: { op: Operadora; className?: string; tamanho?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <OperadoraIcone op={op} tamanho={tamanho} />
      <span className={cn("truncate font-black tracking-tight dark:contrast-50", className)} style={{ color: op.cor }}>
        {op.nome}
      </span>
    </span>
  );
}

const data = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** De onde vem o preço do plano: tabela de venda (com vigência), referência ANS (VCM) ou fictício. */
export function OrigemPreco({ plano, className }: { plano: Plano; className?: string }) {
  const texto =
    plano.origemPreco === "tabela"
      ? `Tabela de venda${plano.vigencia ? ` · vigência ${data(plano.vigencia)}` : ""}`
      : plano.origemPreco === "ans"
        ? "Referência ANS"
        : "Valores fictícios";
  const titulo =
    plano.origemPreco === "ans"
      ? "Valor comercial da mensalidade (VCM) da nota técnica registrada na ANS, com o ajuste da operadora."
      : undefined;
  return (
    <span className={cn("text-xs text-muted-foreground", className)} title={titulo} data-origem={plano.origemPreco}>
      {texto}
    </span>
  );
}
