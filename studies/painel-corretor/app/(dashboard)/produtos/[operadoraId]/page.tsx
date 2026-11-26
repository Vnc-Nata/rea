import { notFound } from "next/navigation";
import { ProdutoDetalhe } from "@/components/produtos";
import { catalogo } from "@/lib/catalogo";
import { precoDisponivel, precoTotal } from "@/lib/utils";
import { vidasVazias, type Plano } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Produto({
  params,
  searchParams,
}: {
  params: Promise<{ operadoraId: string }>;
  searchParams: Promise<{
    modalidade?: string;
    segmento?: string;
    cidade?: string;
    mei?: string;
    contratacao?: string;
  }>;
}) {
  const { operadoraId } = await params;
  const { modalidade = "PME", segmento = "Saúde", cidade = "São Paulo - SP", mei, contratacao } = await searchParams;
  const cat = catalogo();
  const op = cat.operadoras.find((o) => o.id === operadoraId);
  if (!op) notFound();
  const ficticio = cat.fonte === "ficticio";
  // Ordena pelo preço de 1 vida na faixa 29-33 (referência simples); sem preço nessa faixa vai para o fim.
  const ref = [{ nome: "ref", vidas: { ...vidasVazias(), "29-33": 1 } }];
  const chave = (p: Plano) => (precoDisponivel(p, ref) ? precoTotal(p, ref) : Infinity);
  const planos = cat.planos
    .filter(
      (p) =>
        p.operadoraId === op.id &&
        p.modalidade === modalidade &&
        p.segmento === segmento &&
        p.cidades.includes(cidade) &&
        (!ficticio || !mei || p.aceitaMei) &&
        (!ficticio || !contratacao || p.contratacao === contratacao),
    )
    .map((p) => ({ ...p, cidades: [cidade] }))
    .sort((a, b) => chave(a) - chave(b));
  const hospIds = new Set(planos.flatMap((p) => p.rede.map((r) => r.hospitalId)));
  return (
    <ProdutoDetalhe
      op={op}
      planos={planos}
      hospitais={cat.hospitais.filter((h) => hospIds.has(h.id))}
      titulo={`${segmento} ${modalidade} · ${cidade}`}
      ficticio={ficticio}
    />
  );
}
