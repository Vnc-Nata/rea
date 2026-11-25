import Link from "next/link";
import { notFound } from "next/navigation";
import { OperadoraLogo } from "@/components/brand";
import { RegistrarVisualizacao } from "@/components/proposta";
import { buttonClass } from "@/lib/button";
import { readDb } from "@/lib/db";
import { numero, precoTotal, totalVidas } from "@/lib/utils";

// Visão geral da proposta enviada ao cliente (link do botão "Enviar").
export default async function Proposta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;
  const db = readDb();
  const c = db.cotacoes.find((x) => x.id === id);
  if (!c) notFound();
  const q = preview ? "?preview=1" : "";
  return (
    <>
      <RegistrarVisualizacao cotacaoId={c.id} preview={!!preview} />
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{c.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {c.cenarios.length} opções de planos para {totalVidas(c.grupos)} vidas
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[repeat(auto-fill,_minmax(230px,_1fr))]">
        {c.cenarios.map((cen) => {
          const p = db.planos.find((x) => x.id === cen.planoId);
          if (!p) return null;
          const op = db.operadoras.find((o) => o.id === p.operadoraId)!;
          return (
            <div key={cen.id} className="flex flex-col gap-4 rounded bg-background p-6 shadow-sm">
              <OperadoraLogo op={op} className="text-2xl" />
              <div className="text-sm text-foreground/70">
                <div className="font-medium text-foreground">{p.nome}</div>
                <div>
                  {p.segmento} {p.modalidade} · {p.acomodacao === "Quarto Individual" ? "Apartamento" : "Enfermaria"}
                </div>
                <div>{p.coparticipacao}</div>
              </div>
              <div className="mt-auto flex items-end gap-1">
                <span>R$</span>
                <span className="text-2xl font-semibold text-primary">{numero(precoTotal(p, c.grupos))}</span>
                <span className="text-xs">/mês</span>
              </div>
              <Link href={`/cotacoes/${c.id}/cenarios/${cen.id}${q}`} className={buttonClass({ variant: "outline" })}>
                Ver detalhes
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
