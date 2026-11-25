import { AnsHeader, BuscaAnsLista } from "@/components/busca-ans";
import { BuscaAnsRealLista } from "@/components/busca-ans-real";
import { lerBaseAns } from "@/lib/ans";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BuscaAns({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // Com a base oficial importada (npm run importar-ans), a busca usa dados reais da ANS.
  const base = lerBaseAns();
  if (base) return <BuscaAnsRealLista base={base} sp={sp} />;
  const { operadoras, planos } = readDb();
  return (
    <>
      <AnsHeader />
      <BuscaAnsLista operadoras={operadoras} planos={planos} />
    </>
  );
}
