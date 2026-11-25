import { notFound } from "next/navigation";
import { ProdutoDetalhe } from "@/components/produtos";
import { readDb } from "@/lib/db";

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
  const db = readDb();
  const op = db.operadoras.find((o) => o.id === operadoraId);
  if (!op) notFound();
  const planos = db.planos.filter(
    (p) =>
      p.operadoraId === op.id &&
      p.modalidade === modalidade &&
      p.segmento === segmento &&
      p.cidades.includes(cidade) &&
      (!mei || p.aceitaMei) &&
      (!contratacao || p.contratacao === contratacao),
  );
  return (
    <ProdutoDetalhe op={op} planos={planos} hospitais={db.hospitais} titulo={`${segmento} ${modalidade} · ${cidade}`} />
  );
}
