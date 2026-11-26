import { AnsHeader, BuscaAnsLista } from "@/components/busca-ans";
import { AvisoBaseIlegivel, BuscaAnsRealLista } from "@/components/busca-ans-real";
import { lerBaseAnsSegura } from "@/lib/ans";
import { catalogo } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export default async function BuscaAns({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // Com a base oficial importada (npm run importar-ans), a busca usa dados reais da ANS.
  const { base, ilegivel } = lerBaseAnsSegura();
  if (ilegivel) return <AvisoBaseIlegivel />;
  if (base) return <BuscaAnsRealLista base={base} sp={sp} />;
  // Sem base: catálogo fictício (pequeno), filtrado no navegador.
  const { operadoras, planos, cidades } = catalogo();
  return (
    <>
      <AnsHeader />
      <BuscaAnsLista operadoras={operadoras} planos={planos} cidades={cidades} />
    </>
  );
}
