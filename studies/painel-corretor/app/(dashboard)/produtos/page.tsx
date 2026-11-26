import { ProdutosGrid } from "@/components/produtos";
import { catalogo } from "@/lib/catalogo";
import { CIDADE_PADRAO, cidadeValida } from "@/lib/selecao";

export const dynamic = "force-dynamic";

export default function Produtos() {
  const { cidades, fonte } = catalogo();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Produtos</h1>
      <ProdutosGrid cidades={cidades} cidadeInicial={cidadeValida(CIDADE_PADRAO, cidades)} fonte={fonte} />
    </>
  );
}
