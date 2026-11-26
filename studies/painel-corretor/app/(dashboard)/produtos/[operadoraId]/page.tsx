import { notFound } from "next/navigation";
import { ProdutoDetalhe } from "@/components/produtos";
import { catalogo } from "@/lib/catalogo";
import { precoTotal } from "@/lib/utils";
import { vidasVazias } from "@/lib/types";

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
  // Ordena pelo preço de 1 vida na faixa 29-33 (referência simples para a lista).
  const ref = [{ nome: "ref", vidas: { ...vidasVazias(), "29-33": 1 } }];
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
    .sort((a, b) => precoTotal(a, ref) - precoTotal(b, ref));
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
