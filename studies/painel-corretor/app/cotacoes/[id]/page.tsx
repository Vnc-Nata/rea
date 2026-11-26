import Link from "next/link";
import { notFound } from "next/navigation";
import { OperadoraLogo, OrigemPreco } from "@/components/brand";
import { Imprimir, PlanoIndisponivel, RegistrarVisualizacao } from "@/components/proposta";
import { buttonClass } from "@/lib/button";
import { operadoraPorId, planoPorId } from "@/lib/catalogo";
import { readDb } from "@/lib/db";
import { OPCOES_PADRAO } from "@/lib/types";
import { numero, precoDisponivel, precoTotal, totalVidas } from "@/lib/utils";

// Visão geral da proposta enviada ao cliente (link do botão "Enviar").
export default async function Proposta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string; print?: string }>;
}) {
  const { id } = await params;
  const { preview, print } = await searchParams;
  const db = readDb();
  const c = db.cotacoes.find((x) => x.id === id);
  if (!c) notFound();
  const q = preview ? "?preview=1" : "";
  const o = c.opcoes ?? OPCOES_PADRAO;
  const expirada = !!o.validade && new Date(`${o.validade}T23:59:59`) < new Date();
  if (expirada && !preview)
    return (
      <div className="mx-auto max-w-md rounded bg-background p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Proposta expirada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fale com o seu corretor para receber uma proposta atualizada.
        </p>
      </div>
    );
  const cenarios = [...c.cenarios].sort((a, b) => Number(!!b.destaque) - Number(!!a.destaque));
  const itens = cenarios.map((cen) => {
    const p = planoPorId(cen.planoId);
    const op = p && operadoraPorId(p.operadoraId);
    return { cen, p: op ? p : undefined, op };
  });
  return (
    <>
      <RegistrarVisualizacao cotacaoId={c.id} preview={!!preview} />
      <Imprimir ativo={!!print} />
      {o.validade && (
        <p className="mb-2 text-xs text-muted-foreground">
          {expirada ? "Expirada em " : "Válida até "}
          {o.validade.split("-").reverse().join("/")}
        </p>
      )}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{c.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {itens.filter((x) => x.p).length} opções de planos para {totalVidas(c.grupos)} vidas
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[repeat(auto-fill,_minmax(230px,_1fr))]">
        {itens.map(({ cen, p, op }) => {
          if (!p || !op)
            return <PlanoIndisponivel key={cen.id} cotacaoId={c.id} cenarioId={cen.id} removivel={!!preview} />;
          return (
            <div
              key={cen.id}
              className={`relative flex flex-col gap-4 rounded border-2 bg-background p-6 shadow-sm ${cen.destaque ? "border-primary" : "border-background"}`}
            >
              {cen.destaque && (
                <span className="absolute -top-3 left-4 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  Recomendado
                </span>
              )}
              <OperadoraLogo op={op} className="text-2xl" />
              {o.maisInfo && (
                <div className="text-sm text-foreground/70">
                  <div className="font-medium text-foreground">{p.nome}</div>
                  <div>
                    {p.segmento} {p.modalidade} · {p.acomodacao === "Quarto Individual" ? "Apartamento" : "Enfermaria"}
                  </div>
                  <div>{p.coparticipacao}</div>
                </div>
              )}
              {!o.maisInfo && <div className="text-sm font-medium">{p.nome}</div>}
              {o.valores && !precoDisponivel(p, c.grupos) && (
                <div className="mt-auto text-sm text-muted-foreground">Preço indisponível para esta distribuição</div>
              )}
              {o.valores && precoDisponivel(p, c.grupos) && (
                <div className="mt-auto flex items-end gap-1">
                  <span>R$</span>
                  <span className="text-2xl font-semibold text-primary">{numero(precoTotal(p, c.grupos))}</span>
                  <span className="text-xs">/mês</span>
                </div>
              )}
              {o.valores && <OrigemPreco plano={p} className="-mt-3" />}
              <Link
                href={`/cotacoes/${c.id}/cenarios/${cen.id}${q}`}
                className={buttonClass({ variant: "outline" }, "mt-auto print:hidden")}
              >
                Ver detalhes
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
