import { notFound } from "next/navigation";
import { AnsHeader, BuscaAnsDetalhe } from "@/components/busca-ans";
import { readDb } from "@/lib/db";

export default async function BuscaAnsOperadora({
  params,
  searchParams,
}: {
  params: Promise<{ registro: string }>;
  searchParams: Promise<{ modalidade?: string }>;
}) {
  const { registro } = await params;
  const { modalidade } = await searchParams;
  const db = readDb();
  const op = db.operadoras.find((o) => o.registroAns === registro);
  if (!op) notFound();
  const planos = db.planos
    .filter((p) => p.operadoraId === op.id)
    .sort((a, b) => Number(b.modalidade === modalidade) - Number(a.modalidade === modalidade));
  return (
    <>
      <AnsHeader />
      <BuscaAnsDetalhe op={op} planos={planos} hospitais={db.hospitais} />
    </>
  );
}
