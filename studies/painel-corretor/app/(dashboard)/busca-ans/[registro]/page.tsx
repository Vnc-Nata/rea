import { notFound } from "next/navigation";
import { AnsHeader, BuscaAnsDetalhe } from "@/components/busca-ans";
import { AvisoBaseIlegivel, BuscaAnsRealDetalhe } from "@/components/busca-ans-real";
import { lerBaseAnsSegura, lerIndicadoresAns, lerRedeAns, semErro } from "@/lib/ans";
import { catalogo } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export default async function BuscaAnsOperadora({
  params,
  searchParams,
}: {
  params: Promise<{ registro: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { registro } = await params;
  const sp = await searchParams;
  const { base, ilegivel } = lerBaseAnsSegura();
  if (ilegivel) return <AvisoBaseIlegivel />;
  if (base?.operadoras.some((o) => o.registroAns === registro))
    return (
      <BuscaAnsRealDetalhe
        base={base}
        registro={registro}
        sp={sp}
        indicadores={semErro(lerIndicadoresAns)}
        rede={semErro(lerRedeAns)}
      />
    );
  const db = catalogo(); // sem base ANS: catálogo fictício
  const op = db.operadoras.find((o) => o.registroAns === registro);
  if (!op) notFound();
  const planos = db.planos
    .filter((p) => p.operadoraId === op.id)
    .sort((a, b) => Number(b.modalidade === sp.modalidade) - Number(a.modalidade === sp.modalidade));
  return (
    <>
      <AnsHeader />
      <BuscaAnsDetalhe op={op} planos={planos} hospitais={db.hospitais} />
    </>
  );
}
